---
title: [처음부터 따라하기] 10. ONNX 변환 + 백엔드 실제 모델 연결
date: 2026-06-22
category: 개발/품질검사시스템
tags: [ONNX, 백엔드연동, 모델배포]
excerpt: 시리즈의 마지막 글. Colab에서 학습시킨 모델을 ONNX로 변환해 FastAPI 백엔드에 연결하고, 더미 모델을 실제 AI로 교체합니다.
---

이 시리즈의 마지막 글입니다. Colab에서 학습시킨 4개의 모델을 실제 웹 서비스에 연결해서, 더미 모델을 완전히 실제 AI로 교체합니다.

---

## 1. ONNX로 변환하는 이유 (다시 정리)

04번 글에서 짚었듯, PyTorch는 학습에 특화된 무거운 프레임워크입니다. 우리 AI 서버는 Render의 **무료 플랜(메모리 512MB)**에서 돌아가야 하므로, 추론(예측)만 가볍게 할 수 있는 **ONNX** 형식으로 변환합니다.

```
[Colab: PyTorch로 학습] → [.onnx 파일로 변환] → [Render: onnxruntime으로 가볍게 추론]
```

---

## 2. YOLOv8 모델 → ONNX 변환

```python
model_welding.export(format='onnx', imgsz=640)
model_surface.export(format='onnx', imgsz=640)
model_assembly.export(format='onnx', imgsz=640)

import glob, shutil
for name, label in [('welding_model', 'welding'), ('surface_model', 'surface'), ('assembly_model', 'assembly')]:
    found = glob.glob(f'runs/detect/{name}*/weights/best.onnx')
    if found:
        shutil.copy(found[0], f'exported_models/{label}.onnx')
```

Ultralytics 라이브러리는 `.export(format='onnx')` 한 줄로 변환을 끝낼 수 있게 만들어져 있습니다 (PyTorch 모델을 직접 ONNX로 변환하는 복잡한 과정을 알아서 처리해줍니다). 변환되면 학습 때 가중치가 저장됐던 `runs/detect/.../weights/best.pt` 옆에 `best.onnx`가 같이 생깁니다. 그걸 찾아서(`glob.glob`) 보기 좋은 이름(`welding.onnx` 등)으로 복사해뒀습니다.

## 3. EfficientNet(카테고리 분류기) → ONNX 변환

YOLOv8과 달리 일반 PyTorch 모델은 `torch.onnx.export()`라는 PyTorch 자체의 함수로 변환합니다.

```python
model_cat.eval()
dummy = torch.randn(1, 3, 224, 224).to(device)
torch.onnx.export(
    model_cat, dummy, 'exported_models/category.onnx',
    input_names=['input'], output_names=['output'],
    dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}},
    opset_version=12,
)
```

### 뜯어보기

- **`model_cat.eval()`**: 변환 전에 반드시 평가 모드로 바꿔야 합니다 (09번 글에서 본 것처럼, 학습 모드와 평가 모드는 일부 레이어의 동작이 다릅니다 — 예를 들어 드롭아웃 같은 레이어는 평가 시에는 꺼져야 합니다).
- **`dummy = torch.randn(1, 3, 224, 224)`**: ONNX 변환은 "이 모델에 실제로 이런 모양의 입력을 한 번 흘려보내면서, 그 계산 과정 자체를 기록"하는 방식으로 동작합니다. 그래서 실제 데이터가 아니라 **모양만 맞는 무작위 값(dummy, 가짜 데이터)**을 하나 만들어서 통과시킵니다. `(1, 3, 224, 224)`는 "배치 1개, 채널 3개(RGB), 가로세로 224"라는 뜻입니다.
- **`dynamic_axes={'input': {0: 'batch_size'}, ...}`**: 위에서 배치 크기를 1로 고정해서 변환했지만, 실제 서비스에서는 한 번에 여러 장을 같이 추론할 수도 있습니다. `dynamic_axes`는 "0번째 축(배치 크기)은 고정하지 말고, 나중에 몇 개든 유연하게 받아들이게 해달라"는 설정입니다.
- **`opset_version=12`**: ONNX 표준의 "버전"을 지정합니다. 버전이 다르면 지원하는 연산자 종류가 다를 수 있어서, 너무 낮은 버전을 지정하면 변환이 실패하거나 다른 버전으로 자동 전환되기도 합니다. (실제로 이 프로젝트에서도 12로 지정했지만 최신 PyTorch가 자동으로 18버전으로 올려서 저장한 적이 있었는데, onnxruntime은 폭넓은 버전을 다 지원하므로 문제없이 작동했습니다.)

변환하면 `category.onnx`와 함께 `category.onnx.data`라는 파일이 같이 생기기도 합니다 — 모델 크기가 어느 정도 이상이면 가중치 데이터를 별도 파일로 분리해서 저장하는 ONNX의 동작 방식입니다. **이 두 파일은 항상 같은 폴더에 같이 둬야** 합니다.

---

## 4. `real_model.py` 전체 코드

이제 4개의 `.onnx` 파일을 FastAPI 서버에 연결하는 핵심 코드입니다.

```python
# models/real_model.py
# 실제 학습된 AI 모델로 추론합니다 (Colab에서 학습 → ONNX로 변환한 4개 모델 사용)
#
# 처리 순서:
#   1) category.onnx   → 사진이 용접/표면/조립 중 무엇인지 판별
#   2) welding/surface/assembly.onnx (YOLOv8) → 판별된 도메인의 불량 위치를 탐지
#      탐지된 박스가 없으면(또는 전부 "정상" 클래스면) → 정상 판정

import os
import numpy as np
import onnxruntime as ort
from PIL import Image

from schemas.inspection import InspectionResponse, DefectBox

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")

CATEGORY_CLASSES = ["welding", "surface", "assembly"]

WELDING_CLASS_MAP = {
    0: "bead_defect",  # Bad Weld
    1: None,            # Good Weld → 정상
    2: "weld_missing",  # Defect
}
SURFACE_CLASS_MAP = {
    0: "delamination",  # crazing
    1: "contamination",  # inclusion
    2: "contamination",  # patches
    3: "dent",            # pitted surface
    4: "rust",             # rolled-in scale
    5: "scratch",          # scratches
}
ASSEMBLY_CLASS_MAP = {
    0: "bolt_missing", 1: "hole_misalign", 2: "part_missing",
    3: "wrong_orientation", 4: "shape_mismatch", 5: "bolt_missing",
}

CLASS_MAPS = {"welding": WELDING_CLASS_MAP, "surface": SURFACE_CLASS_MAP, "assembly": ASSEMBLY_CLASS_MAP}

DEFECT_TYPE_KR = {
    "bead_defect": "비드 형상 불량", "weld_missing": "용접 누락",
    "crack": "균열", "undercut": "언더컷", "overlap": "오버랩", "spatter": "과도한 스패터",
    "rust": "녹·부식", "scratch": "긁힘", "dent": "찍힘·찌그러짐",
    "delamination": "표면 박리", "contamination": "오염",
    "bolt_missing": "볼트·너트 누락", "hole_misalign": "구멍 위치 불량",
    "part_missing": "부품 누락", "wrong_orientation": "부품 방향 오류", "shape_mismatch": "기준 형상 불일치",
}

CONF_THRESH = 0.35
IOU_THRESH = 0.5

_sessions: dict[str, ort.InferenceSession] = {}


def _get_session(name: str) -> ort.InferenceSession:
    if name not in _sessions:
        path = os.path.join(WEIGHTS_DIR, f"{name}.onnx")
        _sessions[name] = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    return _sessions[name]


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


def _classify_category(image: Image.Image) -> tuple[str, float]:
    """category.onnx로 용접/표면/조립 판별"""
    session = _get_session("category")
    img = image.convert("RGB").resize((224, 224))
    arr = np.asarray(img).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    arr = arr.transpose(2, 0, 1)[None].astype(np.float32)

    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: arr})
    logits = outputs[0][0]
    probs = _softmax(logits)
    idx = int(np.argmax(probs))
    return CATEGORY_CLASSES[idx], float(probs[idx])


def _letterbox(image: Image.Image, size: int = 640):
    """가로세로 비율을 유지하면서 size x size 정사각형으로 패딩 (YOLO 표준 전처리)"""
    img = image.convert("RGB")
    w, h = img.size
    scale = size / max(w, h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh))
    canvas = Image.new("RGB", (size, size), (114, 114, 114))
    pad_x, pad_y = (size - nw) // 2, (size - nh) // 2
    canvas.paste(resized, (pad_x, pad_y))
    return canvas, scale, pad_x, pad_y


def _iou(a: dict, b: dict) -> float:
    ax1, ay1 = a["cx"] - a["w"] / 2, a["cy"] - a["h"] / 2
    ax2, ay2 = a["cx"] + a["w"] / 2, a["cy"] + a["h"] / 2
    bx1, by1 = b["cx"] - b["w"] / 2, b["cy"] - b["h"] / 2
    bx2, by2 = b["cx"] + b["w"] / 2, b["cy"] + b["h"] / 2
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    union = a["w"] * a["h"] + b["w"] * b["h"] - inter
    return inter / union if union > 0 else 0.0


def _nms(boxes: list, iou_thresh: float = IOU_THRESH) -> list:
    boxes = sorted(boxes, key=lambda b: b["confidence"], reverse=True)
    keep = []
    while boxes:
        best = boxes.pop(0)
        keep.append(best)
        boxes = [b for b in boxes if _iou(best, b) < iou_thresh]
    return keep


def _run_yolo(category: str, image: Image.Image) -> list:
    """YOLOv8 onnx 모델 실행 → 0~1 비율 좌표의 박스 리스트 반환"""
    session = _get_session(category)
    canvas, scale, pad_x, pad_y = _letterbox(image, 640)
    arr = np.asarray(canvas).astype(np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)[None]

    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: arr})
    pred = outputs[0][0]            # (4+num_classes, 8400)
    pred = pred.transpose(1, 0)     # (8400, 4+num_classes)

    boxes_xywh = pred[:, :4]
    class_scores = pred[:, 4:]
    class_ids = np.argmax(class_scores, axis=1)
    confidences = np.max(class_scores, axis=1)

    keep_mask = confidences > CONF_THRESH
    results = []
    img_w, img_h = image.size
    for (cx, cy, w, h), cls_id, conf in zip(boxes_xywh[keep_mask], class_ids[keep_mask], confidences[keep_mask]):
        orig_cx = (cx - pad_x) / scale
        orig_cy = (cy - pad_y) / scale
        orig_w  = w / scale
        orig_h  = h / scale
        results.append({
            "cx": orig_cx / img_w, "cy": orig_cy / img_h,
            "w": orig_w / img_w, "h": orig_h / img_h,
            "class_id": int(cls_id), "confidence": float(conf),
        })

    return _nms(results)


def _calc_severity_and_action(confidence: float) -> tuple[str, str]:
    if confidence >= 0.90:
        return "불합격", "작업자 육안검사 및 재작업이 필요합니다."
    elif confidence >= 0.75:
        return "재검사", "정밀 재검사를 권장합니다."
    else:
        return "주의", "경미한 의심 소견입니다. 작업 진행 가능하나 추후 모니터링하세요."


def real_inspect(image: Image.Image) -> InspectionResponse:
    """실제 학습된 모델로 검사종류 판별 + 불량 탐지를 수행합니다."""
    category, cat_conf = _classify_category(image)
    class_map = CLASS_MAPS[category]

    detections = _run_yolo(category, image)
    defect_dets = [d for d in detections if class_map.get(d["class_id"]) is not None]

    if not defect_dets:
        return InspectionResponse(
            result="normal",
            confidence=0.95 if not detections else round(1.0 - max(d["confidence"] for d in detections) * 0.3, 3),
            inspection_category=category,
            category_confidence=round(cat_conf, 3),
            defect_type=None, defect_boxes=[], severity=None,
            recommended_action="정상 - 조치 불필요", message="정상 판정",
        )

    best = max(defect_dets, key=lambda d: d["confidence"])
    defect_type = class_map[best["class_id"]]
    confidence = best["confidence"]
    severity, action = _calc_severity_and_action(confidence)

    boxes = [
        DefectBox(x=d["cx"], y=d["cy"], width=d["w"], height=d["h"],
                  label=class_map.get(d["class_id"]) or "기타", confidence=round(d["confidence"], 3))
        for d in defect_dets
    ]

    return InspectionResponse(
        result="defect", confidence=round(confidence, 3),
        inspection_category=category, category_confidence=round(cat_conf, 3),
        defect_type=defect_type, defect_boxes=boxes, severity=severity,
        recommended_action=action,
        message=f"불량 감지: {DEFECT_TYPE_KR.get(defect_type, defect_type)}",
    )
```

---

## 5. 한 줄씩 깊이 뜯어보기

### 클래스 매핑 딕셔너리 — 모델의 숫자 출력을 우리 시스템의 언어로 번역

```python
WELDING_CLASS_MAP = {
    0: "bead_defect",  # Bad Weld
    1: None,             # Good Weld → 정상
    2: "weld_missing",   # Defect
}
```

09번 글에서 본 학습 로그에 `names: {0: 'Bad Weld', 1: 'Good Weld', 2: 'Defect'}`라고 나온 것을 기억하실 겁니다. 모델은 사진을 보고 "0번 클래스다, 1번 클래스다"라는 **숫자**만 알려줄 뿐, 그 숫자가 "비드 형상 불량"인지 "정상"인지는 모릅니다. 이 매핑 딕셔너리가 그 번역을 담당합니다.

특히 **`1: None`**이 중요합니다 — "Good Weld(정상 용접)" 클래스가 탐지되어도, 그건 불량이 아니므로 우리 시스템의 불량 목록에는 포함시키지 않겠다는 뜻입니다. 아래 코드에서 이 `None`을 걸러내는 부분이 나옵니다.

### `_sessions` 딕셔너리로 모델을 한 번만 로드하기

```python
_sessions: dict[str, ort.InferenceSession] = {}

def _get_session(name: str) -> ort.InferenceSession:
    if name not in _sessions:
        path = os.path.join(WEIGHTS_DIR, f"{name}.onnx")
        _sessions[name] = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    return _sessions[name]
```

`ort.InferenceSession(경로)`는 onnx 파일을 읽어서 추론할 수 있게 메모리에 올리는 작업인데, **꽤 시간이 걸리는 작업**입니다. 만약 검사 요청이 들어올 때마다 매번 새로 모델을 로드한다면, 사용자가 사진 한 장을 검사할 때마다 몇 초씩 더 기다려야 할 것입니다.

`_sessions` 딕셔너리는 "이미 로드한 모델은 캐시(저장)해두고, 다음에 또 필요하면 새로 로드하지 않고 캐시에서 바로 꺼내 쓴다"는 패턴입니다 — `if name not in _sessions:`로 "처음 요청된 모델인지" 확인하고, 처음이면 로드해서 저장해두고, 두 번째 요청부터는 그 저장된 걸 그냥 재사용합니다. 이걸 **메모이제이션(memoization)**이라고도 부릅니다 (04번에서 본 React의 `useMemo`와 같은 아이디어를, 여기서는 Python으로 직접 구현한 것입니다).

### 카테고리 분류기 추론 — `_classify_category`

```python
img = image.convert("RGB").resize((224, 224))
arr = np.asarray(img).astype(np.float32) / 255.0
mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
arr = (arr - mean) / std
arr = arr.transpose(2, 0, 1)[None].astype(np.float32)
```

이 전처리 과정은 09번 글에서 본 `transforms.Compose([Resize, ToTensor, Normalize])`를 **PyTorch 없이 numpy로 직접 재현한 것**입니다. ONNX로 추론할 때는 PyTorch 자체가 없어도 동작해야 하므로(가벼운 onnxruntime만 쓰니까), 학습할 때와 똑같은 전처리를 numpy 연산으로 손수 구현해야 합니다.

- `np.asarray(img) / 255.0`: 이미지를 숫자 배열로 바꾸고, 0~255 범위를 0~1로 정규화 (`ToTensor`와 동일한 효과)
- `(arr - mean) / std`: 09번 글에서 본 Normalize와 정확히 같은 공식
- **`arr.transpose(2, 0, 1)`**: 이게 까다로운 부분입니다. 이미지를 numpy로 읽으면 보통 `(높이, 너비, 채널)` 순서로 배열이 만들어집니다. 그런데 PyTorch/ONNX 모델은 `(채널, 높이, 너비)` 순서를 기대합니다. `transpose(2, 0, 1)`은 "기존 배열의 2번째 축(채널)을 맨 앞으로, 0번째(높이)를 그 다음, 1번째(너비)를 마지막으로 재배열하라"는 뜻입니다.
- **`[None]`**: 배열 맨 앞에 크기 1인 차원을 추가합니다. 모델은 "여러 장을 한 번에(배치로) 처리할 수 있는" 형태(`배치, 채널, 높이, 너비`)를 기대하므로, 사진 한 장이라도 "배치 크기 1"이라는 차원을 추가로 만들어줘야 합니다.

```python
outputs = session.run(None, {input_name: arr})
logits = outputs[0][0]
probs = _softmax(logits)
```

- **`session.run(None, {입력이름: 데이터})`**: onnxruntime에 데이터를 넣고 추론을 실행합니다. 첫 번째 인자(`None`)는 "모든 출력을 다 받겠다"는 뜻이고, 두 번째는 "이 입력 이름에 이 데이터를 매칭하라"는 딕셔너리입니다.
- **`logits`**: 모델이 마지막에 내놓는 "정규화되지 않은 점수"입니다. 보통 3개 클래스라면 `[2.1, -0.5, 0.8]`처럼 임의의 실수 3개가 나옵니다.
- **`_softmax(logits)`**: 이 임의의 점수들을 **"합이 1이 되는 확률"**로 바꿔주는 함수입니다.

```python
def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()
```

소프트맥스(softmax)는 분류 모델에서 거의 항상 마지막에 쓰이는 함수입니다. 공식은 `exp(x_i) / sum(exp(x_j))`인데, 점수가 큰 클래스일수록 지수함수(`exp`)를 거치며 더 두드러지게 커집니다. `x - np.max(x)`를 먼저 빼주는 이유는, `exp()`에 너무 큰 수를 넣으면 컴퓨터가 표현할 수 있는 범위를 넘어가는 **오버플로(overflow)**가 날 수 있어서, 최댓값을 미리 빼줘도 최종 비율은 똑같이 유지되면서 수치적으로 더 안전해지기 때문입니다 (이런 처리를 "수치 안정화"라고 합니다).

### letterbox — 사진을 정사각형으로 만들면서 비율은 유지하기

```python
def _letterbox(image: Image.Image, size: int = 640):
    img = image.convert("RGB")
    w, h = img.size
    scale = size / max(w, h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh))
    canvas = Image.new("RGB", (size, size), (114, 114, 114))
    pad_x, pad_y = (size - nw) // 2, (size - nh) // 2
    canvas.paste(resized, (pad_x, pad_y))
    return canvas, scale, pad_x, pad_y
```

YOLOv8은 640×640 같은 정사각형 입력을 기대합니다. 그런데 원본 사진이 가로로 길거나(예: 1920×1080) 세로로 길면, 그냥 억지로 정사각형으로 늘려버리면 **사물의 비율이 일그러집니다**(원이 타원이 되는 식). 이를 막기 위한 표준적인 기법이 **letterbox**입니다 — 영화를 TV 화면 비율에 맞춰 상하에 검은 띠를 넣는 것과 같은 원리입니다.

```
원본 (가로로 긴 사진)          letterbox 처리 후 (640x640)
┌────────────────┐            ┌──────────────────┐
│                │            │ (회색 패딩)        │
│     사진        │     →      ├──────────────────┤
│                │            │   사진 (비율유지)   │
└────────────────┘            ├──────────────────┤
                              │ (회색 패딩)        │
                              └──────────────────┘
```

- **`scale = size / max(w, h)`**: 가로/세로 중 더 긴 쪽이 정확히 `size`(640)가 되도록 하는 배율을 계산
- **`Image.new("RGB", (size, size), (114, 114, 114))`**: 회색(114,114,114는 YOLO가 표준적으로 쓰는 패딩 색) 정사각형 캔버스를 새로 만듦
- **`canvas.paste(resized, (pad_x, pad_y))`**: 비율을 유지한 채 줄인 사진을, 캔버스 중앙에 붙여넣음

이 함수가 `scale`, `pad_x`, `pad_y`도 같이 반환하는 이유는, 모델이 알려주는 박스 좌표는 "640x640 캔버스 기준"이라서, 나중에 **원본 사진 기준 좌표로 다시 환산**할 때 이 값들이 필요하기 때문입니다 (바로 다음에 나옵니다).

### YOLO 출력 해석하기 — `_run_yolo`

```python
outputs = session.run(None, {input_name: arr})
pred = outputs[0][0]            # (4+num_classes, 8400)
pred = pred.transpose(1, 0)     # (8400, 4+num_classes)
```

09번 글의 학습 로그에서 `output shape(s) (1, 7, 8400)`라는 걸 본 적이 있습니다 (용접 모델, 클래스 3개라 4+3=7). 이게 무슨 뜻이냐면:

- **8400**: 640×640 이미지를 작은 격자들로 잘게 나눈 "후보 위치"의 총 개수입니다 (YOLOv8은 여러 크기의 격자를 합쳐서 8400개의 후보를 만듭니다)
- **7 (= 4 + 클래스수)**: 각 후보 위치마다, `[중심x, 중심y, 너비, 높이, 클래스0점수, 클래스1점수, 클래스2점수]` 7개의 숫자를 예측합니다

즉 "8400개의 후보 박스 각각에 대해 위치와 클래스별 점수를 예측"한 것이 원래 출력 모양(`(7, 8400)`)이고, 이걸 다루기 편하게 `(8400, 7)`로 뒤집은 것입니다(`transpose`).

```python
boxes_xywh = pred[:, :4]                       # 앞 4개 칸 = 위치
class_scores = pred[:, 4:]                      # 나머지 칸 = 클래스별 점수
class_ids = np.argmax(class_scores, axis=1)      # 각 후보마다 가장 점수 높은 클래스
confidences = np.max(class_scores, axis=1)        # 그 점수 자체 (confidence로 사용)
```

- `pred[:, :4]`: numpy의 슬라이싱 문법으로, "모든 행(`:`)의, 0~3번째 칸만" 잘라냄
- `np.argmax(배열, axis=1)`: 각 행(`axis=1` 방향)에서 가장 큰 값의 **위치(인덱스)**를 찾음 — "이 후보가 어떤 클래스일 가능성이 가장 높은지"
- `np.max(배열, axis=1)`: 같은 방향에서 가장 큰 **값 자체** — "그 가능성이 얼마나 높은지(confidence)"

```python
keep_mask = confidences > CONF_THRESH
```

8400개의 후보 중 대부분은 confidence가 매우 낮습니다(빈 배경이거나 애매한 위치). `CONF_THRESH = 0.35`보다 낮은 건 다 걸러내서, 진짜 의미 있는 후보들만 남깁니다.

```python
for (cx, cy, w, h), cls_id, conf in zip(boxes_xywh[keep_mask], class_ids[keep_mask], confidences[keep_mask]):
    orig_cx = (cx - pad_x) / scale
    orig_cy = (cy - pad_y) / scale
    orig_w  = w / scale
    orig_h  = h / scale
    results.append({
        "cx": orig_cx / img_w, "cy": orig_cy / img_h,
        "w": orig_w / img_w, "h": orig_h / img_h,
        ...
    })
```

이 부분이 **letterbox로 변형됐던 좌표를, 원본 사진 기준 0~1 비율 좌표로 되돌리는 계산**입니다.

1. `(cx - pad_x) / scale`: 모델이 알려준 좌표(640×640 캔버스 기준, 패딩 포함)에서 패딩만큼을 빼고, letterbox할 때 줄였던 비율(`scale`)로 다시 나눠서 "원본 사진의 픽셀 좌표"로 복원
2. `/ img_w`, `/ img_h`: 그 픽셀 좌표를 다시 원본 사진의 가로/세로 길이로 나눠서 0~1 비율로 변환

이렇게 변환된 좌표가 바로 06번 글에서 본 `DefectBox`의 `x, y, width, height`(0~1 비율)와 정확히 같은 형식이 되어, 프론트엔드에서 그대로 화면에 그릴 수 있게 됩니다.

### 최종 판정 로직 — `real_inspect`

```python
def real_inspect(image: Image.Image) -> InspectionResponse:
    category, cat_conf = _classify_category(image)
    class_map = CLASS_MAPS[category]

    detections = _run_yolo(category, image)
    defect_dets = [d for d in detections if class_map.get(d["class_id"]) is not None]

    if not defect_dets:
        return InspectionResponse(result="normal", ...)

    best = max(defect_dets, key=lambda d: d["confidence"])
    ...
    return InspectionResponse(result="defect", ...)
```

전체 흐름을 정리하면:

```
1. 카테고리 분류기로 "용접/표면/조립" 중 무엇인지 판별 (category, cat_conf)
2. 그 카테고리에 맞는 YOLO 모델로 객체 탐지 실행 (detections)
3. 탐지된 것들 중 "정상 클래스(None으로 매핑된 것)"를 제외하고 실제 불량만 추림 (defect_dets)
4. 불량이 하나도 없으면 → "정상" 응답
5. 불량이 있으면 → 가장 confidence 높은 것을 대표로 삼아 심각도/권장조치 계산 → "불량" 응답
```

`max(리스트, key=lambda d: d["confidence"])`는 "리스트의 각 항목에서 `confidence` 값을 꺼내 비교했을 때, 그게 가장 큰 항목"을 찾는 Python의 관용적인 표현입니다. `lambda`는 이름 없는 짧은 함수를 즉석에서 만드는 문법입니다 (Python의 익명함수).

**탐지된 박스가 하나도 없으면 자동으로 "정상"이 되는 구조**가 04번 글에서 미리 짚었던 "YOLO 방식을 쓰면 정상 사진을 따로 학습시킬 필요가 없다"는 장점이 실제로 구현된 부분입니다.

---

## 6. 라우터 연결 — 더미와 실제 모델을 환경변수로 전환

05번 글에서 만든 `routers/inspection.py`의 마지막 부분을 다시 보면:

```python
dummy_mode = os.getenv("DUMMY_MODE", "true").lower() == "true"

if dummy_mode:
    from models.dummy_model import dummy_inspect
    result = dummy_inspect(pil_image)
else:
    from models.real_model import real_inspect
    result = real_inspect(pil_image)
```

이 한 줄(`DUMMY_MODE` 환경변수)로, **코드를 전혀 안 건드리고** Render의 환경변수 설정만 `true → false`로 바꾸면 더미 모델에서 실제 AI 모델로 전체 시스템이 전환됩니다. 이게 바로 05번 글에서 "더미 모델을 먼저 만드는" 전략의 진짜 가치였습니다 — 처음부터 이런 스위치 구조로 설계해뒀기 때문에, AI 모델이 준비되는 순간 막힘없이 바로 실서비스에 연결할 수 있었습니다.

```python
# requirements.txt에 추가
onnxruntime>=1.17.0
```

onnxruntime 패키지만 추가로 설치하면 끝입니다. PyTorch, Ultralytics 같은 학습용 라이브러리는 **운영 서버에는 전혀 설치할 필요가 없습니다** — 학습은 Colab에서 한 번만 하고, 결과물(.onnx 파일)만 가져오기 때문입니다. 이게 무거운 학습 환경과 가벼운 운영 환경을 분리하는 것의 실질적인 이점입니다.

---

## 7. 전체 시스템 최종 동작 흐름 정리

```
[사용자] 사진 업로드
    │
    ▼
[FastAPI] POST /inspect
    │
    ▼
[real_model.py]
    ① category.onnx로 추론 → "welding" 88% 확신
    ② welding.onnx(YOLOv8)로 추론 → 8400개 후보 중 confidence>0.35만 추림 → NMS로 중복 제거
    ③ "Good Weld"(정상) 아닌 탐지가 남아있으면 → 그 중 가장 확실한 것을 대표 불량으로 선정
    ④ confidence로 심각도(주의/재검사/불합격) 규칙 적용
    │
    ▼
[JSON 응답] { result: "defect", inspection_category: "welding", defect_type: "bead_defect", ... }
    │
    ▼
[Next.js] 결과 화면에 표시 + Supabase에 저장
```

이것으로 "더미 데이터로 전체 화면을 먼저 완성 → 실제 데이터셋으로 AI 모델 학습 → ONNX로 경량화 → 실제 서버에 연결"까지, 풀스택 + AI 프로젝트의 전체 사이클을 한 바퀴 돌았습니다.

---

## 8. 전체 시리즈 정리

| 글 | 핵심 내용 |
|----|----------|
| 00 | 프로젝트 개요, 3-서버 아키텍처 |
| 01 | Supabase 테이블 설계, RLS, 트리거 |
| 02 | Next.js Server/Client Component, 인증, 미들웨어 |
| 03 | CRUD 패턴, 낙관적 업데이트 |
| 04 | 과적합, Precision/Recall, IoU, mAP, 전이학습 |
| 05 | FastAPI 기초, 더미 모델로 먼저 전체 흐름 완성하기 |
| 06 | 이미지 업로드, FormData, 드래그앤드롭, 좌표 변환 |
| 07 | 필터링, 페이지네이션, 데이터 집계, recharts |
| 08 | Git/GitHub, Vercel/Render 배포, CORS, 운영환경 트러블슈팅 |
| 09 | Colab에서 YOLOv8 + EfficientNet 실제 학습 |
| 10 | ONNX 변환, onnxruntime 추론 코드, letterbox, NMS 직접 구현 |

처음부터 끝까지 따라오셨다면, 데이터베이스 설계부터 인증, CRUD, AI 모델 학습, 배포까지 **풀스택 + AI 프로젝트 하나를 완전히 처음부터 만들어본** 경험을 쌓으신 겁니다. 같은 패턴(서버/클라이언트 분리, CRUD, 전이학습, ONNX 경량화)은 다른 어떤 도메인의 프로젝트에도 거의 그대로 적용할 수 있으니, 꼭 한번 직접 코드를 타이핑해보면서 익혀보시길 권합니다.
