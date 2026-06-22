---
title: [처음부터 따라하기] 09. Colab에서 YOLOv8 모델 학습시키기
date: 2026-06-22
category: 개발/품질검사시스템
tags: [YOLOv8, Colab, 모델학습]
excerpt: 랜덤 결과만 주던 더미 모델을 진짜 사진을 보고 판단하는 AI 모델로 바꾸는 과정. Google Colab의 무료 GPU로 YOLOv8을 학습시킵니다.
---

이번 글이 이 시리즈의 핵심입니다. 지금까지는 랜덤 결과만 주던 더미 모델을, **진짜 사진을 보고 판단하는 AI 모델**로 바꾸는 과정입니다. 04번 글에서 배운 개념들(과적합, mAP, transfer learning 등)이 여기서 전부 실제로 쓰입니다.

---

## 1. 왜 Google Colab을 쓰는가

AI 모델 학습은 **GPU(그래픽 처리 장치)**가 있으면 수십~수백 배 빠릅니다. 일반 노트북에는 학습에 적합한 GPU가 없는 경우가 많은데, **Google Colab**은 구글이 무료로 GPU(Tesla T4 등)를 빌려주는 클라우드 환경입니다. 브라우저에서 Python 코드를 셀(cell) 단위로 실행하는 "노트북" 형태로 되어 있습니다.

1. [colab.research.google.com](https://colab.research.google.com) → 새 노트북
2. 수정 → 노트북 설정 → 하드웨어 가속기 → **T4 GPU** 선택 → 저장

---

## 2. 데이터셋 준비 — YOLO 형식이란?

객체 탐지 모델을 학습시키려면, 사진마다 "여기에 어떤 종류의 물체가 어디에 있다"는 정답(라벨)이 있어야 합니다. **YOLO 형식**은 이 정답을 표현하는 사실상의 표준 형식입니다.

```
dataset/
├── train/
│   ├── images/        ← 학습용 사진들 (image001.jpg, ...)
│   └── labels/         ← 각 사진의 정답 (image001.txt, ...)
├── valid/
│   ├── images/
│   └── labels/
└── data.yaml            ← 클래스 이름, 폴더 경로 등 설정 정보
```

라벨 파일(`image001.txt`)의 한 줄은 다음과 같은 형식입니다.

```
0 0.512 0.487 0.124 0.098
```

순서대로 `클래스번호 중심x비율 중심y비율 너비비율 높이비율`입니다 — 06번 글에서 본 우리 프로젝트의 `DefectBox` 좌표 형식과 똑같습니다(중심점 + 너비/높이의 0~1 비율). 사진 한 장에 불량이 여러 개 있으면, 한 줄씩 여러 줄이 들어갑니다.

`data.yaml`은 보통 이렇게 생겼습니다.

```yaml
train: ../train/images
val: ../valid/images
nc: 3
names: ['Bad Weld', 'Good Weld', 'Defect']
```

`nc`(number of classes)는 클래스 개수, `names`는 각 클래스 번호(0, 1, 2...)에 대응하는 이름입니다.

이 프로젝트에서는 3개의 공개 데이터셋을 가져와서 썼습니다:

| 검사종류 | 데이터셋 | 클래스 |
|---------|---------|--------|
| 용접 | Kaggle "Welding Defect Object Detection" | Bad Weld, Good Weld, Defect |
| 표면 | Roboflow "NEU surface defect" | crazing, inclusion, patches, pitted_surface, rolled-in_scale, scratches |
| 조립 | Roboflow "Missing Bolt Detection" | B1~B6 (볼트 위치별 클래스) |

> Roboflow는 데이터셋을 YOLOv8 형식으로 바로 내려받을 수 있는 무료 플랫폼입니다(가입은 구글 계정으로 간단하게 가능).

### Train/Test를 구분해서 활용하기

04번 글에서 배운 대로, **각 데이터셋을 다운로드하면 이미 `train`/`valid`(또는 `test`) 폴더로 나뉘어 있었습니다.** 이 프로젝트에서는 모델 학습에는 `train` 폴더를, 그리고 나중에 우리 웹사이트에서 "테스트용 샘플 이미지"로 보여줄 사진은 일부러 `test`/`valid` 폴더에서 골랐습니다 — 모델이 학습 때 한 번도 보지 못한 사진으로 정직하게 시연하기 위해서입니다.

---

## 3. 패키지 설치 및 데이터셋 업로드

```python
!pip install -q ultralytics onnx
import ultralytics
ultralytics.checks()
```

**Ultralytics**는 YOLOv8을 만든 회사가 제공하는 Python 패키지입니다. 몇 줄의 코드로 데이터 학습부터 평가, 모델 변환까지 다 처리할 수 있게 만들어져 있습니다. `ultralytics.checks()`는 GPU가 잘 인식됐는지, 버전이 맞는지 등을 확인해주는 점검 함수입니다.

```python
from google.colab import files
print("용접 데이터셋 zip을 선택하세요")
uploaded = files.upload()
import zipfile
zip_name = list(uploaded.keys())[0]
with zipfile.ZipFile(zip_name, 'r') as z:
    z.extractall('welding_raw')
```

- `files.upload()`: Colab이 제공하는 함수로, 브라우저의 파일 선택 창을 띄워서 내 컴퓨터의 파일을 Colab 서버로 업로드합니다. 반환값(`uploaded`)은 `{파일명: 바이너리데이터}` 형태의 딕셔너리입니다.
- `zipfile.ZipFile(경로, 'r')`: 압축 파일을 "읽기 모드(r)"로 엶
- `z.extractall('welding_raw')`: 압축을 풀어서 `welding_raw`라는 새 폴더에 모든 내용을 저장

같은 방식으로 표면(`surface_raw`)과 조립(`assembly_raw`) 데이터셋도 각각 업로드합니다.

```python
import glob
for name in ['welding_raw', 'surface_raw', 'assembly_raw']:
    yamls = glob.glob(f'{name}/**/data.yaml', recursive=True)
    print(name, '→', yamls)
```

`glob.glob(패턴, recursive=True)`은 와일드카드(`**`, `*`)가 포함된 경로 패턴에 맞는 모든 파일을 찾아주는 함수입니다. `**`는 "몇 단계 깊이의 하위 폴더든 다 포함해서" 찾으라는 뜻입니다. 압축을 풀고 나면 폴더 구조가 데이터셋마다 조금씩 다를 수 있어서(`data.yaml`이 바로 아래 있을 수도, 한 단계 더 들어가야 할 수도), 이렇게 자동으로 찾아서 정확한 경로를 확인하는 단계를 거쳤습니다.

---

## 4. YOLOv8 모델 학습 — 핵심 코드

```python
from ultralytics import YOLO

model_welding = YOLO("yolov8n.pt")  # 가벼운 nano 모델
model_welding.train(
    data="welding_raw/The Welding Defect Dataset/data.yaml",
    epochs=40,
    imgsz=640,
    batch=16,
    name="welding_model",
    patience=10,
)
```

### 한 줄씩 뜯어보기

#### `YOLO("yolov8n.pt")`
`yolov8n.pt`는 04번 글에서 설명한 **사전학습된(pretrained) 모델 파일**입니다. "n"은 "nano"의 줄임말로, YOLOv8 모델 중 가장 작고 빠른 버전입니다 (n < s < m < l < x 순으로 점점 커지고 정확해지지만 느려집니다). 이미 COCO라는 대규모 데이터셋(80종의 일반 사물)으로 학습된 가중치가 들어있는 파일이고, 처음 실행하면 자동으로 인터넷에서 다운로드됩니다.

가벼운 nano 모델을 고른 이유: ① Colab의 무료 GPU로도 빠르게 학습 가능, ② 나중에 Render 같은 작은 무료 서버에서도 돌려야 하므로 가벼운 모델이 유리합니다.

#### `model.train(data=..., epochs=40, imgsz=640, batch=16, name=..., patience=10)`

- **`data`**: 앞서 찾은 `data.yaml` 경로. 학습/검증 데이터가 어디 있는지, 클래스가 몇 개인지 등 모든 정보가 여기 담겨 있습니다.
- **`epochs=40`**: 전체 데이터를 40번 반복 학습 (04번 글 참고)
- **`imgsz=640`**: 모든 입력 이미지를 640×640 픽셀로 통일해서 학습. (원본 사진은 크기가 제각각이라, 모델에 넣기 전에 통일된 크기로 맞춰야 합니다.)
- **`batch=16`**: 16장씩 묶어서 한 번에 학습
- **`name="welding_model"`**: 이 학습 결과(가중치 파일, 로그 등)가 저장될 폴더 이름 (`runs/detect/welding_model/`에 저장됨)
- **`patience=10`**: 조기 종료(Early Stopping) 설정. 검증 성능이 10 epoch 동안 개선이 없으면 자동으로 학습을 멈춥니다.

같은 코드를 표면(`surface_model`)과 조립(`assembly_model`)에도 각각 데이터 경로만 바꿔서 반복했습니다.

---

## 5. 실제 학습 로그 해석하기

학습을 실행하면 매 epoch마다 이런 로그가 출력됩니다.

```
      Epoch    GPU_mem   box_loss   cls_loss   dfl_loss  Instances       Size
       1/40      2.06G      2.072      3.219      1.735         26        640
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)
                   all        176        573      0.125       0.54      0.214     0.0936
...
      40/40      2.52G      1.226      1.177      1.237         15        640
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)
                   all        176        573      0.532      0.624      0.576      0.327
```

1번째 epoch에서는 `mAP50`이 0.214였는데, 40번째 epoch에서는 0.576까지 올라간 걸 볼 수 있습니다 — **모델이 학습을 거치며 점점 더 잘 맞히게 된다**는 게 숫자로 확인됩니다.

학습이 끝나면 클래스별 최종 성적표가 나옵니다.

```
              Bad Weld         87        127      0.627      0.709       0.66      0.394
             Good Weld        119        253      0.671      0.726      0.725      0.457
                Defect         90        193      0.514      0.252       0.36      0.146
```

실제로 이 프로젝트에서 학습시킨 3개 모델의 최종 결과를 비교하면:

| 모델 | mAP50 | 비고 |
|------|-------|------|
| 용접 결함 탐지 | **0.582** | Good Weld(정상)는 0.725로 잘 구분, Defect 클래스는 0.36으로 다소 약함 |
| 표면 결함 탐지 | **0.503** | patches(0.366), scratches(0.479) 클래스가 비교적 잘 잡힘 |
| 조립 결함 탐지 | **0.953** | 매우 우수. 정밀도 94.6%, 재현율 95.8% |

조립 모델의 성능이 유독 좋았던 이유는, 데이터의 패턴이 비교적 일정하고(부품 위치가 고정된 사진들) 클래스 간 구분이 명확했기 때문으로 보입니다. 반면 용접/표면은 사진의 각도, 조명, 재질 변화가 더 다양해서 모델이 패턴을 학습하기 더 어려웠던 것으로 해석할 수 있습니다.

---

## 6. 카테고리 분류기 학습 — "이 사진이 어떤 도메인인지" 구분하기

YOLOv8 3개는 각각 "이미 용접 사진인 걸 알고 있을 때 불량을 찾는" 모델입니다. 그런데 사용자는 카테고리를 직접 고르지 않고 사진만 올리므로, **"이 사진이 용접/표면/조립 중 무엇인지"를 먼저 판단하는 4번째 모델**이 필요합니다. 이건 분류(Classification) 문제이므로 YOLOv8 대신 EfficientNet을 썼습니다.

### 학습 데이터 만들기 — 3개 데이터셋의 사진을 도메인 라벨로 재활용

```python
import os, glob, shutil, random
from pathlib import Path

cat_dir = Path('category_data')
for cat in ['welding', 'surface', 'assembly']:
    (cat_dir / cat).mkdir(parents=True, exist_ok=True)

sources = {
    'welding':  glob.glob('welding_raw/**/images/*.*', recursive=True),
    'surface':  glob.glob('surface_raw/**/images/*.*', recursive=True),
    'assembly': glob.glob('assembly_raw/**/images/*.*', recursive=True),
}

for cat, files_list in sources.items():
    sample = random.sample(files_list, min(300, len(files_list)))
    for f in sample:
        shutil.copy(f, cat_dir / cat / Path(f).name)
```

핵심 아이디어: **새로운 데이터셋을 또 구할 필요 없이, 이미 갖고 있는 3개의 불량 탐지용 데이터셋의 "사진"만 재활용**합니다. 단, 라벨은 "어떤 불량인지"가 아니라 **"어느 폴더(도메인) 출신인지"**로 바꿔서 씁니다. 즉 같은 사진 데이터를 가지고 두 가지 다른 목적(불량 탐지용 / 도메인 분류용)의 학습에 재사용한 것입니다.

- `random.sample(리스트, n)`: 리스트에서 중복 없이 n개를 무작위로 뽑음 (`random.choice`와 달리 한 번 뽑은 건 다시 안 뽑힘)
- `min(300, len(files_list))`: 사진이 300장보다 적으면 있는 만큼만, 많으면 300장만 — 각 도메인의 데이터 양을 비슷하게 맞춰서 한쪽으로 편향되지 않게 합니다 (**클래스 불균형(class imbalance)**을 피하는 간단한 방법).

### EfficientNet 학습 코드

```python
import torch, torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import transforms, models
from PIL import Image

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

class CategoryDataset(Dataset):
    def __init__(self, root, transform=None):
        self.samples = []
        self.classes = ['welding', 'surface', 'assembly']
        for idx, cls in enumerate(self.classes):
            for f in glob.glob(f'{root}/{cls}/*'):
                self.samples.append((f, idx))
        self.transform = transform
    def __len__(self): return len(self.samples)
    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert('RGB')
        if self.transform: img = self.transform(img)
        return img, label

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

full_ds = CategoryDataset('category_data', transform=transform)
n_val = int(len(full_ds) * 0.2)
train_ds, val_ds = random_split(full_ds, [len(full_ds) - n_val, n_val])
train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
val_loader   = DataLoader(val_ds, batch_size=32)

model_cat = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
model_cat.classifier[1] = nn.Linear(model_cat.classifier[1].in_features, 3)
model_cat = model_cat.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model_cat.parameters(), lr=1e-4)

for epoch in range(8):
    model_cat.train()
    correct, total = 0, 0
    for imgs, labels in train_loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        out = model_cat(imgs)
        loss = criterion(out, labels)
        loss.backward(); optimizer.step()
        correct += (out.argmax(1) == labels).sum().item()
        total += labels.size(0)

    model_cat.eval()
    vcorrect, vtotal = 0, 0
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            out = model_cat(imgs)
            vcorrect += (out.argmax(1) == labels).sum().item()
            vtotal += labels.size(0)
    print(f"Epoch {epoch+1}/8 | 학습정확도 {correct/total:.2%} | 검증정확도 {vcorrect/vtotal:.2%}")
```

### 한 줄씩 뜯어보기

#### `class CategoryDataset(Dataset):`
PyTorch에서 "내 데이터를 어떻게 하나씩 꺼내올지"를 정의하는 표준 방식입니다. `Dataset`이라는 기본 클래스를 상속받아서, 반드시 두 메서드를 구현해야 합니다:
- `__len__`: 전체 데이터가 몇 개인지
- `__getitem__(idx)`: idx번째 데이터(이미지, 라벨)를 어떻게 가져올지

```python
for idx, cls in enumerate(self.classes):
    for f in glob.glob(f'{root}/{cls}/*'):
        self.samples.append((f, idx))
```

`enumerate(리스트)`는 "각 항목과 그 항목의 순서 번호(인덱스)를 같이 돌려주는" 함수입니다. `["welding", "surface", "assembly"]`를 돌면서 `idx`는 0, 1, 2가 되고, 각 폴더의 모든 파일에 "이 파일은 idx번 클래스다"라는 라벨을 붙여서 `self.samples`(파일경로, 라벨번호) 튜플 리스트로 저장합니다.

#### `transforms.Compose([...])` — 이미지 전처리 파이프라인

```python
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])
```

- **`Resize((224, 224))`**: 모든 사진을 224×224로 통일. EfficientNet-B0가 이 크기를 기대하도록 설계되어 있습니다.
- **`ToTensor()`**: PIL 이미지(픽셀값 0~255)를 PyTorch가 계산할 수 있는 **텐서(Tensor)**(다차원 배열) 형태로 바꾸고, 값을 0~1 사이로 정규화합니다.
- **`Normalize(mean=..., std=...)`**: 각 채널(R, G, B)의 값을 "평균을 빼고 표준편차로 나눠서" 재조정합니다. 이 특정 평균/표준편차 값(`[0.485, 0.456, 0.406]`, `[0.229, 0.224, 0.225]`)은 **ImageNet 데이터셋 전체의 통계값**으로, EfficientNet이 원래 이 값으로 정규화된 데이터를 보고 학습했기 때문에, 우리 데이터도 똑같이 맞춰줘야 사전학습된 가중치를 제대로 활용할 수 있습니다.

#### `random_split(데이터셋, [학습개수, 검증개수])`
전체 데이터를 무작위로 학습용/검증용으로 나눕니다. `n_val = int(len(full_ds) * 0.2)`로 전체의 20%를 검증용으로 떼어두는 것 — 04번 글에서 배운 Train/Validation 분리가 여기서 실제로 구현된 것입니다.

#### 마지막 레이어만 바꿔서 전이학습 적용

```python
model_cat = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
model_cat.classifier[1] = nn.Linear(model_cat.classifier[1].in_features, 3)
```

`EfficientNet_B0_Weights.DEFAULT`로 ImageNet(1000종 분류용)으로 미리 학습된 가중치를 불러옵니다. 그런데 원래 모델의 마지막 출력은 "1000개의 클래스 중 하나"를 고르도록 되어 있습니다. 우리는 "용접/표면/조립" **3개**만 구분하면 되므로, 마지막 분류 레이어(`classifier[1]`)만 "3개 출력"을 내는 새 레이어로 갈아끼웁니다. 나머지 레이어(이미지에서 선/질감/모양 등을 뽑아내는 부분)는 ImageNet으로 이미 잘 학습된 것을 그대로 재사용합니다 — 이게 전이학습(Transfer Learning)의 가장 흔한 적용 방식입니다.

#### 학습 루프

```python
for epoch in range(8):
    model_cat.train()          # "학습 모드"로 전환
    for imgs, labels in train_loader:
        optimizer.zero_grad()       # 1) 이전 계산의 기울기 초기화
        out = model_cat(imgs)        # 2) 모델에 이미지를 넣어서 예측값 받기
        loss = criterion(out, labels) # 3) 예측이 정답과 얼마나 다른지 계산
        loss.backward()                # 4) 그 오차를 거꾸로 전파해서, 각 가중치를 얼마나 조정해야 할지 계산
        optimizer.step()                # 5) 실제로 가중치를 조정
```

이 5단계(0으로 초기화 → 예측 → 오차 계산 → 역전파 → 가중치 갱신)는 **PyTorch로 신경망을 학습시킬 때 항상 반복되는 고정된 패턴**입니다. 이 다섯 줄만 기억해두면 어떤 모델을 학습시키든 거의 똑같은 틀을 적용할 수 있습니다.

- **`model_cat.eval()` + `with torch.no_grad():`**: 검증할 때는 "학습 모드"를 끄고(`eval()`), 기울기 계산도 끕니다(`no_grad()`). 검증은 모델의 가중치를 바꾸지 않고 그냥 평가만 하는 단계이므로, 불필요한 계산(기울기 추적)을 꺼서 속도를 높이고 메모리도 아낍니다.

실제로 이 모델은 검증 정확도 **100%**가 나왔습니다 — 용접/표면/조립 사진은 시각적으로 워낙 다르게 생겨서(질감, 색감, 구도가 전혀 다름), 비교적 쉬운 분류 문제였기 때문입니다.

---

## 7. 정리

이번 글의 핵심 개념:

- **YOLO 라벨 형식**: `클래스 중심x 중심y 너비 높이` (모두 0~1 비율)
- **`yolov8n.pt`**: COCO로 사전학습된 가벼운 모델, 여기서부터 전이학습 시작
- **`model.train(epochs, batch, patience, ...)`**: YOLOv8 학습의 핵심 파라미터들
- **mAP50의 실전 해석**: 1 epoch당 점수가 오르는 것을 보며 학습이 잘 되고 있는지 판단
- **Dataset/DataLoader**: PyTorch에서 데이터를 배치 단위로 모델에 공급하는 표준 구조
- **`transforms.Normalize`**: 사전학습된 모델의 통계값에 맞춰 입력을 정규화해야 전이학습이 제대로 동작
- **마지막 레이어 교체**: 사전학습 모델의 몸통은 재사용하고, 출력 레이어만 우리 문제에 맞게 바꾸는 전이학습 기법
- **5단계 학습 루프**: zero_grad → forward → loss → backward → step

다음 글(10)에서는 이렇게 학습한 4개의 모델을 **ONNX로 변환**해서, FastAPI 서버에 실제로 연결하는 마지막 단계를 다룹니다.
