---
title: [처음부터 따라하기] 05. FastAPI로 AI 서버 뼈대 만들기
date: 2026-06-22
category: 개발/품질검사시스템
tags: [FastAPI, API, 더미서버]
excerpt: 실제 AI 모델 없이도 전체 시스템이 작동하도록, 랜덤 결과를 돌려주는 더미 AI 서버를 FastAPI로 먼저 만듭니다.
---

이번 글에서는 실제 AI 모델이 없어도 전체 시스템이 작동하도록, **랜덤 결과를 돌려주는 가짜(더미) AI 서버**를 먼저 만듭니다. 이렇게 하면 "AI 모델 학습"과 "나머지 웹 시스템 개발"을 동시에 진행할 수 있습니다 — 실제로 이 프로젝트도 이 순서로 만들었습니다.

---

## 1. FastAPI란?

**FastAPI**는 Python으로 API 서버를 만드는 프레임워크입니다. "API 서버"란 화면(HTML)을 그려주는 게 아니라, **데이터(JSON)만 주고받는 서버**를 말합니다. 우리 프론트엔드(Next.js)가 사진을 보내면, FastAPI 서버가 그 사진을 분석해서 결과를 JSON으로 돌려주는 역할만 합니다.

Python을 쓰는 이유는 명확합니다 — PyTorch, YOLO, scikit-learn 등 거의 모든 AI/머신러닝 라이브러리가 Python 기반이기 때문입니다.

```cmd
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn[standard] python-multipart Pillow numpy python-dotenv
```

- **venv**: Python 가상환경. 프로젝트마다 패키지를 따로 격리해서 설치하는 공간입니다. 이게 없으면 여러 프로젝트의 패키지 버전이 충돌할 수 있습니다.
- **uvicorn**: FastAPI 코드를 실제로 실행시켜주는 서버 프로그램(ASGI 서버). FastAPI는 "어떤 요청에 어떻게 응답할지"를 정의하는 코드이고, uvicorn이 그걸 실제로 띄워서 네트워크 요청을 받는 역할을 합니다.
- **python-multipart**: 이미지 파일 같은 멀티파트(multipart) 형식의 요청을 처리하기 위해 필요
- **Pillow**: Python에서 이미지를 다루는 표준 라이브러리 (PIL이라고도 부름)

---

## 2. 서버 진입점 — `main.py` 전체 코드

```python
# main.py
# FastAPI 앱 진입점

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers.inspection import router as inspection_router

# .env 파일 로드
load_dotenv()

app = FastAPI(
    title="선박 부품 품질검사 AI API",
    description="AI 기반 선박 부품 이미지 분석 서버",
    version="1.0.0",
)

# ── CORS 설정 ─────────────────────────────────────────
# FRONTEND_URL 환경변수로 Vercel 도메인을 지정합니다.
_frontend_url = os.getenv("FRONTEND_URL", "")
_allowed_origins = [
    "http://localhost:3000",       # 로컬 개발
    "https://*.vercel.app",        # Vercel 와일드카드
]
if _frontend_url:
    _allowed_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",   # 와일드카드 대신 정규식 사용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 라우터 등록 ───────────────────────────────────────
app.include_router(inspection_router, tags=["검사"])


# ── 헬스체크 ──────────────────────────────────────────
@app.get("/health", tags=["시스템"])
async def health_check():
    """서버 상태 확인"""
    dummy_mode = os.getenv("DUMMY_MODE", "true").lower() == "true"
    return {
        "status": "ok",
        "mode": "dummy" if dummy_mode else "model",
        "message": "AI 검사 서버가 정상 작동 중입니다.",
    }


@app.get("/", tags=["시스템"])
async def root():
    return {"message": "선박 부품 품질검사 AI API", "docs": "/docs"}
```

### 한 줄씩 뜯어보기

#### `load_dotenv()`
같은 폴더의 `.env` 파일에 적어둔 `키=값` 쌍들을 읽어서, Python의 `os.environ`(환경변수 저장소)에 넣어줍니다. 이렇게 해두면 코드에 `DUMMY_MODE=true` 같은 설정을 직접 박아넣지 않고, 배포 환경마다 다른 값을 쓸 수 있습니다 (로컬에서는 더미 모드, 운영에서는 실제 모델 모드처럼).

#### `app = FastAPI(title=..., description=..., version=...)`
FastAPI 애플리케이션 객체를 하나 만듭니다. 이 정보들은 자동으로 생성되는 API 문서(`/docs` 주소로 들어가면 보이는 Swagger UI)에 표시됩니다. FastAPI의 장점 중 하나가 **코드만 작성하면 API 문서가 자동으로 만들어진다**는 것입니다.

#### CORS 설정

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**CORS(Cross-Origin Resource Sharing)**는 브라우저의 보안 정책입니다. 기본적으로 브라우저는 "A 주소(`vercel.app`)에서 불러온 페이지가, B 주소(`onrender.com`)로 데이터를 요청하는 것"을 차단합니다 (다른 출처끼리의 요청을 막는다는 뜻). 우리 시스템은 프론트엔드(Vercel)와 AI 서버(Render)가 서로 다른 주소이기 때문에, **"이 주소들에서 오는 요청은 허용한다"**고 서버가 명시적으로 알려줘야 합니다. 이게 CORS 설정의 역할입니다.

- `allow_origins`: 허용할 출처(도메인) 목록
- `allow_origin_regex`: 정규식으로도 허용 가능 — Vercel은 배포할 때마다 약간 다른 서브도메인(`xxx-git-main-username.vercel.app` 등)을 만들기도 해서, 정확한 문자열 목록 대신 정규식 패턴(`https://.*\.vercel\.app`, "vercel.app으로 끝나는 모든 https 주소")으로 한 번에 허용하는 게 더 안전합니다.
- `allow_methods=["*"]`, `allow_headers=["*"]`: 어떤 HTTP 메서드(GET/POST 등)와 헤더든 다 허용

> **트러블슈팅 경험담**: 처음엔 `allow_origins`에 `"https://*.vercel.app"`처럼 와일드카드(`*`)를 문자열에 직접 넣었는데, 브라우저의 CORS 검사는 이런 와일드카드 문자열을 지원하지 않습니다(정확히 일치하는 문자열만 인식). 그래서 별도로 `allow_origin_regex`를 추가해서 정규식으로 처리하도록 고쳤습니다.

#### `app.include_router(inspection_router, tags=["검사"])`
FastAPI는 API 엔드포인트(주소)들을 **라우터(router)**라는 단위로 따로 파일에 작성하고, 메인 앱에 갖다 붙이는 구조를 권장합니다. 이렇게 하면 기능이 늘어나도 `main.py`가 끝없이 길어지지 않습니다. `tags`는 자동 생성 문서에서 이 라우터의 API들을 묶어서 보여줄 그룹 이름입니다.

#### `@app.get("/health")`
**데코레이터(decorator)**라는 Python 문법입니다. `@app.get("/health")`는 "이 바로 아래에 있는 함수를, `GET /health` 요청이 들어왔을 때 실행해라"라고 FastAPI에 등록하는 것입니다. `async def health_check():`로 함수를 정의하면, FastAPI가 그 반환값(딱셔너리)을 자동으로 JSON으로 바꿔서 응답합니다.

`os.getenv("DUMMY_MODE", "true")`는 "환경변수 `DUMMY_MODE`를 읽어오는데, 없으면 기본값 `"true"`를 써라"는 뜻입니다. 이 한 줄로 "더미 모드인지 실제 모델 모드인지"를 서버 외부에서(.env 파일이나 Render 환경변수 설정으로) 손쉽게 바꿀 수 있습니다.

---

## 3. 요청/응답 데이터 형식 정의 — `schemas/inspection.py`

```python
# schemas/inspection.py
# FastAPI 요청/응답 데이터 구조 정의 (Pydantic)

from pydantic import BaseModel
from typing import Optional, List


class DefectBox(BaseModel):
    """불량 위치 바운딩 박스"""
    x: float          # 중심 x 좌표 (0.0 ~ 1.0 비율)
    y: float          # 중심 y 좌표
    width: float      # 박스 너비 비율
    height: float     # 박스 높이 비율
    label: str        # 불량 유형
    confidence: float # 신뢰도


class InspectionResponse(BaseModel):
    """AI 분석 결과 응답"""
    result: str                        # "normal" | "defect"
    confidence: float                  # 신뢰도 (0.0 ~ 1.0)
    inspection_category: str           # "welding" | "surface" | "assembly" - AI가 자동 판별
    category_confidence: float = 1.0   # 검사종류 판별 신뢰도
    defect_type: Optional[str] = None  # 불량 유형 코드 (정상이면 null)
    defect_boxes: List[DefectBox] = [] # 불량 위치 박스들
    severity: Optional[str] = None     # "주의" | "재검사" | "불합격" (정상이면 null)
    recommended_action: str = ""       # 권장 조치 문구
    message: str = ""                  # 추가 메시지
```

### 뜯어보기

#### `class DefectBox(BaseModel):`
**Pydantic**이라는 라이브러리의 `BaseModel`을 상속받아서 데이터 형식을 정의합니다. 이렇게 클래스를 만들면 FastAPI가 자동으로:
1. 들어온 요청 데이터가 이 형식에 맞는지 **검증**해주고
2. 형식이 안 맞으면 자동으로 에러 응답을 만들어주고
3. API 문서에도 이 형식이 자동으로 표시됩니다

#### 좌표를 "비율(0~1)"로 저장하는 이유

```python
x: float  # 중심 x 좌표 (0.0 ~ 1.0 비율)
```

박스 위치를 픽셀(예: "가로 1280px 중 350px 위치")로 저장하지 않고, **전체 가로/세로 길이에 대한 비율(0~1 사이 값)**로 저장합니다. 예를 들어 `x=0.5`는 "이미지 가로 길이의 정확히 중간"이라는 뜻입니다.

이렇게 하는 이유: 프론트엔드 화면에서는 사진이 화면 크기에 맞춰 늘어나거나 줄어듭니다(반응형 디자인). 원본 사진은 4000x3000 픽셀인데 화면에는 800x600으로 줄여서 보여줄 수 있죠. 이때 좌표가 "원본 픽셀 기준"이면 화면 크기에 맞춰 매번 다시 계산해야 하지만, **비율(0~1)로 저장해두면 화면이 어떤 크기든 그냥 `퍼센트 × 화면크기`로 바로 그릴 수 있습니다.** 실제로 프론트엔드 코드에서도 `left: ${(box.x - box.width/2) * 100}%`처럼 그대로 퍼센트(%)로 변환해서 씁니다.

#### `Optional[str] = None`
"이 필드는 문자열이거나, 아니면 아예 없을(None) 수도 있다"는 타입. 정상 판정일 때는 `defect_type`이 있을 이유가 없으니 `None`이 됩니다.

#### `List[DefectBox] = []`
"`DefectBox` 객체들의 리스트이고, 기본값은 빈 리스트"라는 뜻. 정상이면 불량 박스가 하나도 없으니 빈 리스트가 기본입니다.

---

## 4. 이미지 처리 도우미 — `utils/image.py`

```python
# utils/image.py
# 이미지 전처리 유틸리티

from PIL import Image
import io


def read_image(file_bytes: bytes) -> Image.Image:
    """바이트 데이터를 PIL 이미지로 변환"""
    return Image.open(io.BytesIO(file_bytes)).convert("RGB")


def resize_image(image: Image.Image, size: tuple = (224, 224)) -> Image.Image:
    """이미지 크기 조정 (AI 모델 입력용)"""
    return image.resize(size)


def validate_image(file_bytes: bytes) -> bool:
    """유효한 이미지인지 검증"""
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
        return True
    except Exception:
        return False
```

### 뜯어보기

- **`bytes`**: 파일을 네트워크로 받으면 일단 "그냥 0과 1로 된 원시 데이터(바이트)" 형태입니다. 이걸 사진으로 "이해"하려면 PIL 같은 라이브러리로 디코딩해야 합니다.
- **`io.BytesIO(file_bytes)`**: 바이트 데이터를 "파일처럼" 다룰 수 있게 메모리 안에서 가짜 파일 객체로 감싸는 도구. `Image.open()`은 보통 디스크에 있는 파일 경로를 받지만, `BytesIO`를 쓰면 디스크에 저장하지 않고 메모리에서 바로 처리할 수 있습니다.
- **`.convert("RGB")`**: 이미지를 RGB(빨강·초록·파랑 3채널) 형식으로 통일합니다. 업로드되는 사진은 RGBA(투명도 포함), 흑백, CMYK 등 다양한 형식일 수 있는데, AI 모델은 보통 RGB 3채널을 기대하므로 미리 통일해줍니다.
- **`img.verify()`**: 파일이 실제로 손상되지 않은 정상 이미지인지 검사합니다. 악의적인 사용자가 이미지가 아닌 파일에 `.jpg` 확장자만 붙여서 보내는 경우를 걸러내는 보안 장치이기도 합니다.
- **`try/except`로 감싼 이유**: `verify()`가 손상된 파일을 만나면 예외(에러)를 던지는데, 그걸 그대로 두면 서버가 다운될 수 있으니 잡아서 `False`(유효하지 않음)로 처리합니다.

---

## 5. 더미 AI 모델 — `models/dummy_model.py`

진짜 AI 모델 없이도 전체 흐름을 테스트할 수 있게, 랜덤 결과를 돌려주는 가짜 모델입니다.

```python
# models/dummy_model.py
# 더미 AI 모델 - 실제 학습 없이 랜덤 결과를 반환합니다.
# 검사 종류(용접/표면/조립)별로 다른 불량 유형 목록을 사용합니다.

import random
from PIL import Image
from schemas.inspection import InspectionResponse, DefectBox

# ── 검사 종류별 불량 유형 목록 ────────────────────────
DEFECT_TYPES_BY_CATEGORY = {
    "welding": ["crack", "undercut", "overlap", "bead_defect", "weld_missing", "spatter"],
    "surface": ["rust", "scratch", "dent", "delamination", "contamination"],
    "assembly": ["bolt_missing", "hole_misalign", "part_missing", "wrong_orientation", "shape_mismatch"],
}

# 불량 유형별 한국어 이름
DEFECT_TYPE_KR = {
    "crack": "균열", "undercut": "언더컷", "overlap": "오버랩",
    "bead_defect": "비드 형상 불량", "weld_missing": "용접 누락", "spatter": "과도한 스패터",
    "rust": "녹·부식", "scratch": "긁힘", "dent": "찍힘·찌그러짐",
    "delamination": "표면 박리", "contamination": "오염",
    "bolt_missing": "볼트·너트 누락", "hole_misalign": "구멍 위치 불량",
    "part_missing": "부품 누락", "wrong_orientation": "부품 방향 오류",
    "shape_mismatch": "기준 형상 불일치",
}


def _calc_severity_and_action(confidence: float) -> tuple[str, str]:
    """신뢰도 기반으로 심각도와 권장 조치를 규칙 기반으로 계산합니다."""
    if confidence >= 0.90:
        return "불합격", "작업자 육안검사 및 재작업이 필요합니다."
    elif confidence >= 0.75:
        return "재검사", "정밀 재검사를 권장합니다."
    else:
        return "주의", "경미한 의심 소견입니다. 작업 진행 가능하나 추후 모니터링하세요."


def dummy_inspect(image: Image.Image) -> InspectionResponse:
    """
    더미 AI 추론 함수
    - 실제 모델이 없어도 전체 시스템 흐름을 테스트할 수 있습니다.
    - DUMMY_MODE=true 일 때 사용됩니다.
    - 실제 서비스에서는 이미지만 보고 검사종류(용접/표면/조립)까지 AI가 자동 판별합니다.
      더미 모드에서는 이 판별 과정을 랜덤으로 흉내냅니다.
    """
    # ── 1단계: 검사종류 자동 판별 (실제 모델에서는 별도의 분류기가 수행) ──
    category = random.choice(list(DEFECT_TYPES_BY_CATEGORY.keys()))
    category_confidence = round(random.uniform(0.85, 0.99), 3)

    defect_types = DEFECT_TYPES_BY_CATEGORY.get(category, DEFECT_TYPES_BY_CATEGORY["welding"])

    # 70% 확률로 불량 판정 (테스트 목적)
    is_defect = random.random() < 0.7

    if is_defect:
        defect_type = random.choice(defect_types)
        confidence  = round(random.uniform(0.70, 0.98), 3)
        severity, action = _calc_severity_and_action(confidence)

        # 더미 불량 위치 박스 1~2개 생성
        boxes = []
        for _ in range(random.randint(1, 2)):
            cx = round(random.uniform(0.2, 0.8), 3)
            cy = round(random.uniform(0.2, 0.8), 3)
            w  = round(random.uniform(0.08, 0.25), 3)
            h  = round(random.uniform(0.08, 0.20), 3)
            boxes.append(DefectBox(
                x=cx, y=cy,
                width=w, height=h,
                label=defect_type,
                confidence=round(random.uniform(0.65, 0.95), 3),
            ))

        return InspectionResponse(
            result="defect",
            confidence=confidence,
            inspection_category=category,
            category_confidence=category_confidence,
            defect_type=defect_type,
            defect_boxes=boxes,
            severity=severity,
            recommended_action=action,
            message=f"불량 감지: {DEFECT_TYPE_KR.get(defect_type, defect_type)}",
        )
    else:
        confidence = round(random.uniform(0.82, 0.99), 3)
        return InspectionResponse(
            result="normal",
            confidence=confidence,
            inspection_category=category,
            category_confidence=category_confidence,
            defect_type=None,
            defect_boxes=[],
            severity=None,
            recommended_action="정상 - 조치 불필요",
            message="정상 판정",
        )
```

### 뜯어보기

#### `DEFECT_TYPES_BY_CATEGORY = {...}`
Python의 **딕셔너리(dict)**입니다. `"welding"`이라는 키(key)에 대응하는 값(value)으로 불량 유형 리스트를 저장해뒀습니다. `딕셔너리이름[키]`로 값을 꺼낼 수 있습니다 (예: `DEFECT_TYPES_BY_CATEGORY["welding"]`은 6개짜리 리스트를 줍니다).

#### `random.choice(list(딱셔너리.keys()))`
- `딕셔너리.keys()`: 딕셔너리의 모든 키들을 모은 특수한 객체를 반환
- `list(...)`: 그걸 진짜 리스트로 변환 (`["welding", "surface", "assembly"]`)
- `random.choice(리스트)`: 리스트 중에서 무작위로 하나를 고름

즉 이 한 줄로 "용접/표면/조립 중 무작위로 하나를 고른다"를 구현했습니다 — 실제 모델이 들어오면 이 부분이 진짜 카테고리 분류기로 교체됩니다(10번 글에서 다룸).

#### `random.random() < 0.7`
`random.random()`은 0.0~1.0 사이의 무작위 실수를 하나 줍니다. 이 값이 0.7보다 작을 확률은 70%이므로, **70% 확률로 "불량"이 되도록** 만든 코드입니다. (현실의 불량률보다 일부러 높게 잡아서, 테스트할 때 불량 화면도 자주 보이게 한 것입니다.)

#### `_calc_severity_and_action` 함수 이름의 밑줄(`_`)
함수 이름 앞의 밑줄 하나(`_calc...`)는 Python의 관례로 **"이 함수는 이 파일 안에서만 쓰는 내부용 함수"**라는 표시입니다. 강제로 막는 문법은 아니지만, 다른 개발자에게 "이건 바깥에서 직접 부르지 마세요"라는 신호를 줍니다.

#### `tuple[str, str]`
함수가 "문자열 두 개를 묶어서 반환한다"는 타입 표시. 실제로 `return "불합격", "작업자 육안검사..."`처럼 쉼표로 두 값을 같이 반환하면, Python이 자동으로 튜플(tuple, 변경 불가능한 순서있는 묶음)로 묶어줍니다.

#### 박스를 1~2개 무작위로 만드는 부분

```python
for _ in range(random.randint(1, 2)):
    ...
    boxes.append(DefectBox(...))
```

- `random.randint(1, 2)`: 1 또는 2 중 무작위 정수 (양쪽 끝 포함)
- `for _ in range(n):`: "n번 반복한다"는 뜻. 반복 변수를 실제로 안 쓸 때 관례적으로 `_`(언더스코어)라는 이름을 씁니다.
- `boxes.append(...)`: 리스트 끝에 새 항목을 추가

이 함수가 실제 AI 모델로 교체되기 전까지는, **웹사이트의 모든 화면(검사 요청, 검사 이력, 통계 등)을 실제 AI 없이도 완성하고 테스트할 수 있게** 해주는 핵심 도구였습니다.

---

## 6. API 엔드포인트 — `routers/inspection.py`

```python
# routers/inspection.py
# AI 검사 API 엔드포인트

import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from schemas.inspection import InspectionResponse
from utils.image import read_image, validate_image

router = APIRouter()


@router.post("/inspect", response_model=InspectionResponse)
async def inspect_image(image: UploadFile = File(...)):
    """
    이미지를 받아 AI로 정상/불량을 판정합니다.

    검사종류(용접/표면/조립)는 사람이 선택하지 않고 AI가 사진을 보고 자동 판별합니다.

    - DUMMY_MODE=true: 더미 모델로 랜덤 결과 반환 (검사종류도 랜덤 판별)
    - DUMMY_MODE=false: 실제 학습된 모델 사용
    """

    # 파일 유효성 검사
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    file_bytes = await image.read()

    if not validate_image(file_bytes):
        raise HTTPException(status_code=400, detail="유효하지 않은 이미지 파일입니다.")

    # 이미지 → PIL 변환
    pil_image = read_image(file_bytes)

    # 더미 모드 여부 확인
    dummy_mode = os.getenv("DUMMY_MODE", "true").lower() == "true"

    if dummy_mode:
        from models.dummy_model import dummy_inspect
        result = dummy_inspect(pil_image)
    else:
        from models.real_model import real_inspect
        result = real_inspect(pil_image)

    return result
```

### 뜯어보기

#### `@router.post("/inspect", response_model=InspectionResponse)`
"`POST /inspect` 요청이 오면 아래 함수를 실행하고, 응답 형식은 반드시 `InspectionResponse` 모양을 따른다"는 선언입니다. `response_model`을 지정하면 FastAPI가 응답값을 그 형식에 맞게 자동으로 정리해서 보내줍니다(필드가 더 있어도 정의된 것만 내려줌 — 의도치 않은 데이터 유출을 막는 효과도 있습니다).

#### `async def inspect_image(image: UploadFile = File(...))`
함수의 파라미터로 `image: UploadFile = File(...)`를 받습니다.
- **`UploadFile`**: FastAPI가 제공하는 "업로드된 파일"을 표현하는 타입
- **`File(...)`**: "이 값은 폼 데이터의 파일 형태로 받아야 한다"는 표시. `...`(Ellipsis, 줄임표)는 "필수값이다(기본값이 없다)"는 뜻입니다.

#### `if not image.content_type or not image.content_type.startswith("image/"):`
업로드된 파일의 MIME 타입(파일 종류를 나타내는 문자열, 예: `image/jpeg`)을 확인합니다. `image/`로 시작하지 않으면(예: `application/pdf`) 거부합니다. `raise HTTPException(status_code=400, detail="...")`은 "400 Bad Request 에러와 함께 이 메시지를 응답으로 보내라"는 뜻입니다.

#### `await image.read()`
업로드된 파일의 실제 내용(바이트)을 읽어옵니다. 파일을 읽는 것도 시간이 걸리는 작업(I/O 작업)이라 `await`로 기다립니다.

#### 더미 모드 분기

```python
dummy_mode = os.getenv("DUMMY_MODE", "true").lower() == "true"

if dummy_mode:
    from models.dummy_model import dummy_inspect
    result = dummy_inspect(pil_image)
else:
    from models.real_model import real_inspect
    result = real_inspect(pil_image)
```

`import`문이 함수 안, `if` 블록 안에 있다는 점이 특이합니다. 이건 **지연 임포트(lazy import)**라는 기법입니다. 파일 맨 위에서 미리 `import models.real_model`을 해두면, 그 모델 파일이 아직 준비 안 됐거나(이 시점) 무거운 라이브러리(onnxruntime 등)를 불필요하게 매번 로드하게 됩니다. 실제로 그 분기를 타는 순간에만 필요한 모듈을 불러오면, 더미 모드로만 쓸 때는 실제 모델 관련 코드/라이브러리를 아예 신경 쓸 필요가 없어집니다 (10번 글에서 `real_model.py`를 만들기 전까지는 이 `else` 분기가 존재해도 에러가 나지 않는 이유입니다).

---

## 7. 서버 실행하고 테스트하기

```cmd
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- `main:app`: `main.py` 파일 안의 `app`이라는 변수(FastAPI 인스턴스)를 실행하라는 뜻
- `--reload`: 코드를 수정하면 서버가 자동으로 재시작됨 (개발할 때 편리)
- `--host 0.0.0.0`: 모든 네트워크 인터페이스에서 접속을 받음 (배포 환경에서 필요)
- `--port 8000`: 8000번 포트로 서비스

서버를 켠 다음 브라우저에서 `http://localhost:8000/docs`로 들어가면, FastAPI가 자동으로 만들어준 **Swagger UI**라는 테스트 화면이 나옵니다. 여기서 프론트엔드 코드를 짜기 전에도 직접 이미지를 올려서 API가 잘 작동하는지 테스트할 수 있습니다.

---

## 8. 정리

이번 글의 핵심 개념:

- **FastAPI + uvicorn**: API를 정의하는 코드(FastAPI) + 실제로 띄우는 서버(uvicorn)
- **CORS**: 다른 도메인끼리 통신을 허용하는 보안 설정
- **Pydantic BaseModel**: 요청/응답 데이터의 형식을 강제하고 자동 검증
- **좌표를 비율로 저장**: 화면 크기에 무관하게 재사용 가능
- **더미 모델**: 진짜 AI가 준비되기 전, 랜덤 결과로 전체 시스템 흐름을 먼저 완성하는 전략
- **지연 임포트**: 필요한 순간에만 모듈을 불러와서 불필요한 의존성을 피하는 기법

다음 글(06)에서는 프론트엔드에서 이 API를 호출하는 "검사 요청" 화면을 만들어보겠습니다.
