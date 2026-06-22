---
title: [처음부터 따라하기] 08. Vercel + Render로 배포하기
date: 2026-06-22
category: 개발/품질검사시스템
tags: [배포, Vercel, Render]
excerpt: 내 컴퓨터에서만 돌아가던 시스템을 누구나 인터넷에서 접속할 수 있도록 Vercel과 Render에 배포하는 과정입니다.
---

내 컴퓨터(`localhost`)에서만 돌아가던 시스템을, 누구나 인터넷에서 접속할 수 있게 배포하는 과정입니다.

---

## 1. 배포란 무엇인가

지금까지는 `npm run dev`(Next.js)와 `uvicorn main:app`(FastAPI)을 내 컴퓨터에서 실행해서, 내 컴퓨터의 `localhost:3000`, `localhost:8000`으로만 접속할 수 있었습니다. **내 컴퓨터를 끄면 이 서버들도 같이 꺼집니다.**

**배포(Deploy)**는 이 코드를 다른 사람의 컴퓨터(클라우드 서버)에 올려서, 내 컴퓨터를 꺼도 24시간 켜져 있고, 누구나 그 주소로 접속할 수 있게 만드는 작업입니다.

이 프로젝트는 두 곳에 나눠서 배포합니다.

| 무엇을 | 어디에 | 왜 |
|--------|--------|-----|
| Next.js 프론트엔드 | **Vercel** | Next.js를 만든 회사가 직접 운영하는 배포 서비스라 호환성이 가장 좋고, 무료 |
| FastAPI AI 서버 | **Render** | Python 서버를 무료로 띄울 수 있는 대표적인 서비스 |

---

## 2. Git과 GitHub — 배포의 전제조건

Vercel과 Render는 모두 **"GitHub 저장소에 코드를 올려두면, 그걸 가져가서 자동으로 빌드하고 실행해주는"** 방식으로 동작합니다. 그래서 먼저 우리 코드를 Git으로 관리하고 GitHub에 올려야 합니다.

### Git의 핵심 개념

- **저장소(Repository)**: 코드와 코드의 모든 변경 역사를 저장하는 공간
- **커밋(Commit)**: "지금 상태를 하나의 스냅샷으로 저장한다"는 행위. 메시지(`-m "..."`)로 무엇을 바꿨는지 기록
- **푸시(Push)**: 내 컴퓨터에 저장된 커밋들을 GitHub 같은 원격 저장소로 전송하는 것

```cmd
git init                                  # 이 폴더를 Git 저장소로 만듦
git add .                                 # 모든 변경사항을 "커밋할 준비" 상태로 추가
git commit -m "첫 커밋"                    # 스냅샷 저장
git remote add origin <GitHub 저장소 주소>  # 원격 저장소 연결
git branch -M main                         # 기본 브랜치 이름을 main으로
git push -u origin main                    # 업로드
```

### `.gitignore` — 올리면 안 되는 파일 제외하기

```
# 환경변수 (절대 올리면 안 됨!)
.env
.env.local
.env*.local

# Node
frontend/node_modules/
frontend/.next/

# Python
backend/venv/
backend/__pycache__/
```

`.gitignore` 파일에 적힌 패턴과 일치하는 파일/폴더는 `git add .`을 해도 **무시되어 커밋에 포함되지 않습니다.**

- **`.env` 계열을 제외하는 이유**: 이 파일에는 Supabase 비밀 키 같은 민감한 정보가 들어있습니다. GitHub에 공개 저장소로 올리면 전 세계 누구나 볼 수 있으므로, 절대 포함시키면 안 됩니다. (배포 환경의 설정값은 .env 파일이 아니라 Vercel/Render의 "환경변수 설정" 화면에서 별도로 입력합니다.)
- **`node_modules/`, `venv/` 제외 이유**: 이건 비밀 정보는 아니지만, `package.json`/`requirements.txt`만 있으면 언제든 다시 설치할 수 있는 "재생성 가능한" 파일들입니다. 용량이 수백MB까지 커질 수 있어서 Git에 포함시키면 저장소가 불필요하게 무거워집니다.

> **실전에서 겪은 문제**: `.gitignore`는 **새로 추가되는 파일에만** 적용됩니다. 만약 어떤 파일이 `.gitignore`를 만들기 *전에* 이미 한 번 커밋되어 있었다면, 나중에 `.gitignore`에 패턴을 추가해도 이미 추적 중인 파일은 계속 추적됩니다. 그래서 이 프로젝트에서는 항상 **`.gitignore`를 먼저 만들고, 그 다음에 첫 커밋**을 하는 순서를 지켰습니다.

---

## 3. Render에 AI 서버(FastAPI) 배포하기

1. [render.com](https://render.com) → **New + → Web Service**
2. GitHub 저장소 연결
3. 설정값 입력:

| 항목 | 값 |
|------|-----|
| Language | **Python 3** |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

4. Environment Variables(환경변수) 추가:

```
DUMMY_MODE = true   (나중에 false로 변경)
FRONTEND_URL = (Vercel 배포 후 채울 예정)
```

### `Start Command`의 `$PORT`는 무엇인가?

```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

로컬에서 테스트할 때는 `--port 8000`처럼 포트 번호를 직접 정했습니다. 그런데 Render 같은 클라우드 서비스는 **서버를 실행할 때마다 어떤 포트를 쓸지 자기들이 정해서, `PORT`라는 환경변수로 알려줍니다.** `$PORT`는 "그 환경변수의 값을 여기에 그대로 넣어라"는 셸(shell) 문법입니다. 만약 포트를 8000으로 고정해버리면, Render가 실제로 요청을 그 포트로 보내지 않기 때문에 서버가 응답을 못 하는 문제가 생깁니다.

### `--host 0.0.0.0`은 왜 필요한가?

`--host 127.0.0.1`(또는 기본값)로 실행하면 "내 컴퓨터 안에서만" 접속이 가능합니다. 클라우드 서버에서는 외부 인터넷에서 들어오는 요청도 받아야 하므로, **"어떤 네트워크 인터페이스로 들어오든 다 받아라"**는 의미의 `0.0.0.0`으로 설정해야 합니다.

### 무료 플랜의 한계 — 절전 모드(Cold Start)

Render 무료 플랜은 **15분 동안 요청이 없으면 서버를 절전 상태로 내립니다.** 이후 첫 요청이 오면 다시 서버를 깨우는데, 이 과정에 30~60초가 걸릴 수 있습니다. 그래서 한동안 안 쓰다가 갑자기 검사 요청을 하면 "왜 이렇게 느리지?"라는 느낌을 받을 수 있는데, 이건 버그가 아니라 무료 플랜의 정책입니다. (해결: 유료 플랜으로 업그레이드하거나, 주기적으로 핑(ping)을 보내는 외부 서비스를 써서 절전을 막는 방법도 있습니다.)

---

## 4. Vercel에 프론트엔드(Next.js) 배포하기

1. [vercel.com](https://vercel.com) → **Add New... → Project**
2. GitHub 저장소 선택
3. **Root Directory**: `frontend`
4. Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL      = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
NEXT_PUBLIC_AI_API_URL        = https://ship-inspection-ai.onrender.com  (Render 주소)
```

5. **Deploy** 클릭

Vercel은 Next.js 프로젝트를 자동으로 인식해서, 빌드 명령(`npm run build`)과 실행 방식을 알아서 설정해줍니다 — Render와 달리 따로 Build/Start Command를 입력할 필요가 없습니다(Next.js를 만든 회사가 만든 서비스라 그만큼 통합이 잘 되어 있습니다).

배포 후 Render의 `FRONTEND_URL` 환경변수에 방금 생긴 Vercel 주소를 넣어주고 재배포하면, 05번 글에서 본 CORS 설정이 이 주소를 허용 목록에 추가합니다.

---

## 5. 배포 중 만났던 실제 에러들과 해결 과정

배포는 로컬에서 잘 되던 코드도 막상 올리면 새로운 환경 차이로 에러가 자주 납니다. 실제로 겪은 사례들입니다.

### 사례 1: 타입스크립트 빌드 에러

```
./lib/supabase-server.ts:16:16
Type error: Parameter 'cookiesToSet' implicitly has an 'any' type.
```

로컬 개발 서버(`npm run dev`)는 타입 에러가 있어도 일단 실행은 되지만, **Vercel의 운영 빌드(`npm run build`)는 타입 에러가 있으면 빌드 자체를 실패시킵니다.** 운영 빌드가 훨씬 엄격합니다. 해결은 파라미터에 타입을 명시하는 것이었습니다.

```typescript
// 수정 전
setAll(cookiesToSet) { ... }

// 수정 후
setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) { ... }
```

### 사례 2: 외래키(Foreign Key) 제약으로 삭제가 안 되는 문제

```
update or delete on table "ships" violates foreign key constraint "inspections_ship_id_fkey" on table "inspections"
```

01번 글에서 설명한 것처럼, 선박을 참조하는 검사 기록이 남아있으면 그냥 삭제가 안 됩니다. 해결: 외래키에 `ON DELETE CASCADE`를 다시 걸어서, 선박이 삭제되면 관련 블록/검사/불량로그가 자동으로 같이 삭제되게 만들었습니다.

```sql
ALTER TABLE blocks DROP CONSTRAINT blocks_ship_id_fkey;
ALTER TABLE blocks ADD CONSTRAINT blocks_ship_id_fkey
  FOREIGN KEY (ship_id) REFERENCES ships(id) ON DELETE CASCADE;
```

### 사례 3: 캐시 때문에 서버 설정이 안 바뀐 것처럼 보임

`DUMMY_MODE`를 `false`로 바꿔서 재배포했는데, `/health` 응답이 계속 `"mode": "dummy"`로 나온 적이 있었습니다. 똑같은 주소를 쿼리스트링만 다르게(`?nocache=12345`) 다시 요청하자 바로 `"mode": "model"`로 정상 응답이 왔습니다. 이건 중간의 어떤 캐싱 계층(요청 도구 자체의 캐시일 수도, 네트워크 경로상의 캐시일 수도 있음)이 예전 응답을 잠깐 들고 있었던 것으로 보입니다. **"방금 설정을 바꿨는데 옛날 결과가 계속 나온다"면, 일단 캐시를 의심하고 쿼리스트링을 바꿔서 다시 요청해보는 것**도 좋은 디버깅 습관입니다.

---

## 6. 배포 후 확인 체크리스트

| 항목 | 확인 방법 |
|------|----------|
| AI 서버가 살아있는가 | `https://xxx.onrender.com/health` 접속 → `{"status":"ok"}` 확인 |
| 더미/실제 모델 모드가 맞는가 | 같은 주소의 응답에서 `"mode"` 값 확인 |
| 프론트-백엔드 CORS가 뚫려있는가 | 실제 사이트에서 검사 요청 시 콘솔에 CORS 에러가 없는지 확인 |
| Supabase 인증 흐름이 운영 주소에서도 동작하는가 | Supabase 대시보드 → Authentication → URL Configuration에 Vercel 주소를 등록했는지 확인 |
| Storage 버킷이 Public인가 | 검사 사진이 화면에 실제로 보이는지 확인 |

---

## 7. 정리

이번 글의 핵심 개념:

- **배포**: 코드를 클라우드 서버에 올려서 24시간 접속 가능하게 만드는 작업
- **Git/GitHub**: 코드 버전 관리 + Vercel/Render가 코드를 가져가는 통로
- **.gitignore**: 비밀 정보와 재생성 가능한 폴더를 커밋에서 제외
- **`$PORT`, `--host 0.0.0.0`**: 클라우드 환경에 맞춘 서버 실행 설정
- **운영 빌드의 엄격함**: 로컬 개발 서버보다 타입 검사 등이 훨씬 엄격하게 적용됨
- **무료 플랜의 절전(Cold Start)**: Render 무료 플랜의 알려진 특성

다음 글(09)에서는 지금까지 더미로만 작동하던 AI를, **실제로 학습된 YOLOv8 모델**로 교체하는 과정을 다룹니다 — 이 시리즈에서 가장 흥미로운 부분입니다.
