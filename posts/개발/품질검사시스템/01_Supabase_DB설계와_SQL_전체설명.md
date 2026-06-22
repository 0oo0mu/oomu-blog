---
title: [처음부터 따라하기] 01. Supabase로 데이터베이스 만들기
date: 2026-06-22
category: 개발/품질검사시스템
tags: [Supabase, SQL, 데이터베이스]
excerpt: 데이터를 저장할 데이터베이스를 Supabase로 만듭니다. 데이터베이스, 인증, 파일 저장소를 한꺼번에 제공하는 서비스의 개념과 가입 절차를 설명합니다.
---

이번 글에서는 데이터를 저장할 데이터베이스를 만듭니다. Supabase라는 서비스를 쓰는데, 이게 무엇인지부터 짚고 갑니다.

---

## 1. Supabase란?

**Supabase**는 PostgreSQL(포스트그레스큐엘)이라는 정통 관계형 데이터베이스를 기반으로, 다음 3가지를 통째로 묶어서 제공하는 서비스입니다.

1. **데이터베이스(Database)** — 테이블에 데이터를 저장
2. **인증(Auth)** — 회원가입/로그인 기능을 직접 안 만들어도 됨
3. **파일 저장소(Storage)** — 이미지 같은 파일을 저장하고 URL로 접근 가능

이 세 가지를 직접 만들려면(특히 인증) 보안 지식이 많이 필요한데, Supabase가 검증된 방식으로 미리 만들어 둔 걸 가져다 쓰는 것입니다. **무료 플랜**으로도 개인 프로젝트나 포트폴리오 용도로는 충분합니다.

### 회원가입 절차

1. [supabase.com](https://supabase.com) 접속 → GitHub 계정으로 로그인
2. New project → 이름, 비밀번호, 리전(Seoul 추천 — 한국에서 접속 시 더 빠름) 입력
3. 1~2분 기다리면 프로젝트 생성 완료

생성되면 **Project Settings → API**에서 두 가지 값을 복사해둡니다.

```
NEXT_PUBLIC_SUPABASE_URL      = https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
```

이 두 값은 나중에 Next.js 프로젝트의 `.env.local`(환경변수 파일)에 넣어서, 프론트엔드가 이 Supabase 프로젝트에 접속할 수 있게 해줍니다.

---

## 2. 테이블을 만드는 SQL 전체 코드

Supabase 대시보드 좌측 메뉴의 **SQL Editor**에 들어가서 아래 SQL을 실행하면 5개 테이블이 한 번에 만들어집니다. 먼저 전체 코드를 보고, 그 다음 하나씩 뜯어봅니다.

```sql
-- =============================================
-- 1. users 테이블 (Supabase Auth와 연동)
-- =============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'inspector',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. ships 테이블 (선박 정보)
-- =============================================
CREATE TABLE public.ships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ship_type TEXT,
  build_number TEXT,
  status TEXT DEFAULT 'building',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 3. blocks 테이블 (블록 정보)
-- =============================================
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id UUID NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE,
  block_name TEXT NOT NULL,
  process_type TEXT,
  location_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 4. inspections 테이블 (검사 결과)
-- =============================================
CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id UUID REFERENCES public.ships(id),
  block_id UUID REFERENCES public.blocks(id),
  user_id UUID REFERENCES public.users(id),
  image_url TEXT NOT NULL,
  result TEXT NOT NULL,
  defect_type TEXT,
  confidence FLOAT,
  status TEXT DEFAULT 'pending',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 5. defect_logs 테이블 (불량 위치)
-- =============================================
CREATE TABLE public.defect_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE,
  bbox_x FLOAT,
  bbox_y FLOAT,
  bbox_width FLOAT,
  bbox_height FLOAT,
  label TEXT,
  confidence FLOAT
);
```

> 이후 STEP 10에서 검사종류(용접/표면/조립)와 심각도, 권장조치 기능을 추가하면서 `inspections` 테이블에 컬럼 3개를 더 추가했습니다 (`inspection_category`, `severity`, `recommended_action`). 이 부분은 04번 글에서 자세히 다룹니다.

### 한 줄씩 뜯어보기

#### `CREATE TABLE public.users (...)`
"`public` 스키마에 `users`라는 이름의 테이블을 만든다"는 뜻입니다. PostgreSQL은 테이블들을 스키마(schema)라는 폴더 같은 단위로 묶는데, 기본값이 `public`입니다.

#### `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
이 한 줄에 4가지 개념이 들어있습니다.

- **UUID**: `123e4567-e89b-...` 같은 무작위 36자리 문자열. 숫자를 1,2,3 순서대로 매기는 대신 UUID를 쓰면 "다음 id가 몇 번일지 추측이 안 되고", 여러 데이터베이스를 합칠 때 충돌이 안 납니다.
- **PRIMARY KEY(기본키)**: 이 테이블에서 각 행(row)을 구분하는 유일한 값. 절대 중복되면 안 됩니다.
- **REFERENCES auth.users(id)**: "이 id 값은 Supabase가 자동으로 관리하는 `auth.users` 테이블의 id와 같아야 한다"는 외래키(Foreign Key) 제약입니다. 즉 우리가 만든 `public.users`는 회원가입 시스템(`auth.users`)에 딸려가는 "부가 정보 테이블"입니다.
- **ON DELETE CASCADE**: "원본(`auth.users`)에서 사용자가 삭제되면, 여기(`public.users`)에 있는 관련 행도 같이 삭제해라"는 규칙. 영어로 cascade는 "폭포처럼 줄줄이 떨어진다"는 뜻인데, 삭제가 줄줄이 이어진다는 의미로 쓰입니다.

#### `email TEXT UNIQUE NOT NULL`
- **TEXT**: 글자(문자열) 타입
- **UNIQUE**: 같은 값이 중복으로 들어올 수 없음 (이메일이 같은 사람이 두 명일 수 없으니까)
- **NOT NULL**: 반드시 값이 있어야 함 (비워둘 수 없음)

#### `role TEXT DEFAULT 'inspector'`
값을 안 넣으면 자동으로 `'inspector'`(검사원)가 들어갑니다. **DEFAULT**는 "기본값"이라는 뜻입니다.

#### `created_at TIMESTAMPTZ DEFAULT now()`
- **TIMESTAMPTZ**: 시간대(Time Zone)까지 포함한 날짜/시간 타입
- **now()**: 행이 생성된 "바로 지금" 시각을 자동으로 채워주는 함수

#### `gen_random_uuid()`
새 UUID를 자동으로 생성해주는 PostgreSQL 내장 함수. 우리가 직접 `id` 값을 지정 안 해도 행을 추가할 때마다 자동으로 새 UUID가 채워집니다.

#### `ship_id UUID NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE` (blocks 테이블)
이게 바로 "블록은 반드시 어느 선박엔가 속해 있어야 한다"는 규칙입니다. `ship_id`에는 `ships` 테이블에 실제로 존재하는 `id` 값만 들어갈 수 있습니다 — 존재하지 않는 선박 id를 넣으려고 하면 데이터베이스가 거부합니다. 이게 바로 **관계형 데이터베이스(Relational DB)**의 핵심입니다: 데이터 간의 관계를 DB가 직접 보증해줍니다.

> 나중에 "선박을 삭제했더니 블록 삭제가 안 돼요"라는 에러를 만난 적이 있었는데, 원인이 바로 이 외래키 제약 때문이었습니다. 기본 설정으로는 `inspections`가 `ships`/`blocks`를 참조하고 있는데 CASCADE가 안 걸려 있어서, 선박을 지우려고 하면 "이 선박을 참조하는 검사 기록이 있어서 못 지운다"고 막혔습니다. 해결은 외래키에 `ON DELETE CASCADE`를 다시 걸어주는 것이었습니다:
> ```sql
> ALTER TABLE blocks DROP CONSTRAINT blocks_ship_id_fkey;
> ALTER TABLE blocks ADD CONSTRAINT blocks_ship_id_fkey
>   FOREIGN KEY (ship_id) REFERENCES ships(id) ON DELETE CASCADE;
> ```
> `ALTER TABLE`은 "이미 만들어진 테이블의 구조를 바꾼다"는 명령입니다. 기존 제약(`DROP CONSTRAINT`)을 지우고, CASCADE가 포함된 새 제약을 추가(`ADD CONSTRAINT`)한 것입니다.

---

## 3. RLS (Row Level Security) — 보안의 핵심

RLS는 우리말로 "행 단위 보안"입니다. 쉽게 말해 **"누가 어떤 행(row)을 읽고/쓸 수 있는지"를 데이터베이스 차원에서 통제**하는 기능입니다.

왜 필요할까요? 우리 프론트엔드 코드는 브라우저에서 직접 Supabase에 접속해서 데이터를 읽고 씁니다 (서버를 거치지 않음). 이 말은, **누구든 개발자 도구를 열어서 Supabase 접속 키(anon key)를 볼 수 있다**는 뜻입니다. 만약 아무런 보안 규칙이 없다면, 그 키만 가지고 누구나 우리 DB의 모든 데이터를 읽거나 지울 수 있게 됩니다.

RLS는 이런 상황에서도 "로그인 안 한 사람은 아무것도 못 본다", "로그인한 사람만 읽고 쓸 수 있다" 같은 규칙을 DB 레벨에서 강제합니다.

```sql
-- RLS 활성화 (이 스위치를 켜야 정책이 적용됨)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_logs ENABLE ROW LEVEL SECURITY;

-- 로그인한 사용자라면 모든 데이터 읽기/쓰기 허용
CREATE POLICY "Allow all for authenticated users" ON public.ships
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public.blocks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public.inspections
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public.defect_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- users 테이블: 자기 자신의 데이터만 읽기/쓰기 허용
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
```

### 뜯어보기

- **`ENABLE ROW LEVEL SECURITY`**: 일단 이걸 켜면, 정책(POLICY)이 하나도 없는 상태에서는 **아무도 아무것도 못 봅니다** (기본값이 "전부 차단"). 그래서 RLS를 켠 다음에는 반드시 정책을 만들어줘야 합니다.
- **`CREATE POLICY "이름" ON 테이블 FOR ALL USING (조건)`**: "이 조건을 만족하면 모든 작업(읽기/쓰기/수정/삭제)을 허용한다"는 규칙을 만듭니다.
- **`auth.role() = 'authenticated'`**: Supabase가 제공하는 함수로, "현재 요청을 보낸 사람이 로그인된 상태인가?"를 확인합니다. 로그인 안 했으면 `'anon'`(익명)이 됩니다.
- **`auth.uid() = id`**: "현재 로그인한 사람의 고유 id가, 내가 지금 읽으려는 행의 id와 같은가?" — 즉 "자기 데이터만" 보게 만드는 패턴입니다.

> **실무 팁**: 위 정책은 "로그인했으면 다 된다"는 다소 느슨한 정책입니다. 실제 운영 시스템이라면 "관리자만 삭제 가능", "본인이 작성한 검사만 수정 가능" 같이 더 세분화하는 게 맞습니다. 이 프로젝트는 학습/포트폴리오 목적이라 단순화했습니다.

---

## 4. 회원가입 시 자동으로 사용자 정보 만들기 (트리거)

Supabase Auth로 회원가입하면 `auth.users`(Supabase가 관리하는 비공개 테이블)에는 자동으로 저장되지만, 우리가 만든 `public.users`에는 아무것도 안 들어갑니다. 회원가입할 때마다 매번 수동으로 `public.users`에 추가하는 코드를 짜는 대신, **트리거(Trigger)**라는 DB 기능으로 자동화합니다.

```sql
-- 회원가입 자동 처리 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '사용자')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 연결 (가입 시 자동 실행)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 뜯어보기

- **`CREATE FUNCTION ... RETURNS TRIGGER`**: "트리거가 실행될 때 호출될 함수"를 정의합니다. 함수 이름은 `handle_new_user`.
- **`NEW`**: 트리거 함수 안에서 "방금 새로 추가된 행"을 가리키는 특별한 변수입니다. 여기서는 방금 회원가입한 `auth.users`의 새 행을 가리킵니다.
- **`NEW.raw_user_meta_data->>'name'`**: 회원가입할 때 추가로 보낸 정보(이름 등)는 `raw_user_meta_data`라는 JSON 칼럼에 들어갑니다. `->>'name'`은 "이 JSON에서 `name` 키의 값을 텍스트로 꺼내라"는 PostgreSQL의 JSON 추출 문법입니다.
- **`COALESCE(A, B)`**: "A가 비어있으면(NULL) B를 대신 쓴다"는 함수. 즉 회원가입 시 이름을 안 적었으면 `'사용자'`라는 기본값을 넣습니다.
- **`CREATE TRIGGER ... AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION ...`**: "`auth.users`에 새 행이 추가될 때마다(AFTER INSERT), 그 행 하나하나에 대해(FOR EACH ROW) 위에서 만든 함수를 실행하라"는 연결 설정입니다.

이렇게 해두면, 사용자가 회원가입하는 순간 → `auth.users`에 저장됨 → 트리거가 자동 발동 → `public.users`에도 똑같이 정보가 들어갑니다. 우리는 프론트엔드 코드에서 이 부분을 신경 쓸 필요가 전혀 없어집니다.

---

## 5. Storage 버킷 — 이미지 파일 저장 공간

검사 사진은 데이터베이스(테이블)가 아니라 **Storage**라는 별도의 파일 저장 공간에 저장합니다. (데이터베이스는 글자/숫자 데이터를 저장하는 데 최적화되어 있고, 이미지 같은 큰 바이너리 파일은 별도 저장소에 두고 "URL만" DB에 저장하는 게 일반적인 설계입니다.)

1. Supabase 대시보드 → **Storage** → **New bucket**
2. 이름: `inspections`, **Public bucket** 체크 (URL로 누구나 이미지를 볼 수 있게)

```sql
-- 로그인한 사용자는 이미지 업로드 가능
CREATE POLICY "Allow upload for authenticated users"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inspections');

-- 누구나 이미지 읽기 가능 (공개 이미지)
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inspections');
```

이것도 일종의 RLS 정책입니다. Storage에 저장된 파일들도 결국 `storage.objects`라는 테이블의 행으로 관리되기 때문에, 똑같은 정책(POLICY) 문법으로 "누가 업로드할 수 있는지, 누가 읽을 수 있는지"를 정합니다.

---

## 6. 정리

이번 글에서 배운 핵심 개념:

- **UUID**: 추측 불가능한 고유 식별자
- **외래키(FK) + CASCADE**: 데이터 간 관계를 DB가 직접 보증, 삭제도 줄줄이 따라가게 설정 가능
- **RLS(Row Level Security)**: "누가 어떤 행을 보고 쓸 수 있는지"를 DB 차원에서 강제
- **트리거(Trigger)**: 특정 이벤트(여기서는 회원가입)가 발생하면 자동으로 실행되는 함수
- **Storage**: 이미지 같은 파일은 DB가 아니라 별도 저장소에 두고 URL만 참조

다음 글(02)에서는 이 데이터베이스에 접속하는 Next.js 프론트엔드와 로그인 화면을 만들어보겠습니다.
