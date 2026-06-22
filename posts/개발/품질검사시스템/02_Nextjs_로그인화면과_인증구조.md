---
title: [처음부터 따라하기] 02. Next.js로 로그인 화면 만들기
date: 2026-06-22
category: 개발/품질검사시스템
tags: [Next.js, 인증, 로그인]
excerpt: Next.js 프로젝트를 시작하고, 로그인/회원가입 화면과 로그인하지 않으면 접근을 막는 인증 구조를 만듭니다.
---

이번 글에서는 Next.js 프로젝트를 시작하고, 로그인/회원가입 화면과 "로그인 안 하면 못 들어가게 막는" 인증 구조를 만듭니다.

---

## 1. Next.js와 App Router란?

**Next.js**는 React를 기반으로 한 웹 프레임워크입니다. React만 쓰면 "화면을 어떻게 그릴지"만 정해주는데, Next.js는 그 위에 **페이지 라우팅(어떤 주소에 어떤 화면을 보여줄지), 서버에서 미리 데이터 가져오기, 배포 최적화** 등을 더 얹어줍니다.

Next.js 13버전부터 **App Router**라는 새 방식이 나왔는데, 핵심 규칙은 이렇습니다:

> `app/` 폴더 안의 폴더 구조 = 그대로 웹사이트의 주소(URL) 구조

```
app/login/page.tsx        →  웹사이트의 /login 주소
app/dashboard/page.tsx    →  웹사이트의 /dashboard 주소
app/ships/page.tsx        →  웹사이트의 /ships 주소
app/inspections/new/page.tsx → 웹사이트의 /inspections/new 주소
```

폴더 이름이 곧 URL 경로가 되고, 그 폴더 안의 `page.tsx` 파일이 그 페이지의 실제 화면 코드입니다. 이 방식이 편리한 이유는, 라우팅 설정 파일을 따로 작성할 필요가 없다는 점입니다 — 폴더만 만들면 끝입니다.

---

## 2. 프로젝트 설치하기

```cmd
npx create-next-app@14.2.5 frontend --typescript --tailwind --app
cd frontend
npm install @supabase/ssr @supabase/supabase-js lucide-react recharts
```

- `--typescript`: 타입스크립트(자바스크립트 + 타입 검사) 사용
- `--tailwind`: Tailwind CSS 자동 설정
- `--app`: App Router 방식 사용
- `@supabase/ssr`, `@supabase/supabase-js`: Supabase 접속용 라이브러리
- `lucide-react`: 아이콘 라이브러리
- `recharts`: 차트 라이브러리

설치 후 `.env.local` 파일을 만들어서 Supabase 접속 정보를 넣습니다.

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

`NEXT_PUBLIC_` 접두사가 붙은 환경변수는 **브라우저(클라이언트)에서도 접근 가능**합니다. 접두사가 없으면 서버에서만 보입니다. Supabase의 anon key는 원래 공개되어도 괜찮게 설계된 키(RLS로 보호되니까)라서 `NEXT_PUBLIC_`을 붙입니다.

---

## 3. Server Component와 Client Component — 가장 중요한 개념

Next.js App Router를 이해하는 데 가장 헷갈리는 부분이 바로 이것입니다. 파일 맨 위에 `"use client";`가 있는지 없는지로 둘이 구분됩니다.

| | Server Component (기본값) | Client Component (`"use client"` 선언) |
|---|---|---|
| 실행 위치 | 서버에서만 실행 | 브라우저에서 실행 |
| `useState`, `useEffect` 등 React Hook | ❌ 사용 불가 | ✅ 사용 가능 |
| 버튼 클릭, 입력값 변경 등 사용자 상호작용 | ❌ 처리 불가 | ✅ 처리 가능 |
| DB에 직접 비밀 정보로 접속 | ✅ 가능 (서버에만 있으니 안전) | ⚠️ 공개 키만 써야 함 |
| 자바스크립트 용량 | 브라우저로 전송 안 됨 (가벼움) | 브라우저로 전송됨 |

**왜 이렇게 나눠놨을까?** 예전 React는 모든 컴포넌트가 브라우저에서 실행됐습니다. 그런데 "로그인한 사용자 정보 가져오기"처럼 화면이 그려지기 *전에* 필요한 데이터는, 굳이 브라우저까지 가서 또 요청을 보낼 필요 없이 **서버에서 미리 가져와서 화면에 박아서 보내주는 게 더 빠릅니다.** 반면 버튼을 누르면 즉시 반응해야 하는 부분(폼 입력, 모달 열기 등)은 브라우저에서 실행되어야 합니다. 그래서 Next.js는 "기본은 서버에서, 상호작용이 필요한 부분만 명시적으로 클라이언트로"라는 전략을 씁니다.

이 프로젝트에서는 보통:
- **페이지(`page.tsx`)**: Server Component로 두고, DB에서 데이터를 미리 가져옴
- **그 안의 상호작용 컴포넌트(`XxxList.tsx`, `XxxForm.tsx`)**: `"use client"`를 붙여서 버튼/입력 처리

---

## 4. Supabase 클라이언트 — 두 가지 버전이 필요한 이유

Supabase에 접속하는 코드를 만드는데, **브라우저용**과 **서버용**을 따로 만들어야 합니다.

### 브라우저용 (`lib/supabase.ts`)

```typescript
// lib/supabase.ts
// Supabase 클라이언트 - 브라우저(클라이언트 컴포넌트)에서 사용
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- `createBrowserClient`: 브라우저의 쿠키/로컬스토리지를 이용해서 로그인 상태(세션)를 유지하는 클라이언트를 만듭니다.
- `process.env.NEXT_PUBLIC_SUPABASE_URL!` 끝의 `!`는 타입스크립트 문법으로 "이 값은 절대 undefined가 아니다"라고 컴파일러에게 확언하는 것입니다 (환경변수가 실제로 설정되어 있다는 전제 하에).

### 서버용 (`lib/supabase-server.ts`)

```typescript
// lib/supabase-server.ts
// Supabase 클라이언트 - 서버 컴포넌트/미들웨어에서 사용
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createServerSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          // 서버 컴포넌트에서는 쿠키 쓰기가 불가하므로 try/catch로 무시
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 미들웨어에서 세션 갱신을 처리하므로 무시해도 됩니다.
          }
        },
      },
    }
  );
}
```

**왜 다른가?** 브라우저는 쿠키를 `document.cookie`로 직접 다룰 수 있지만, 서버(Next.js의 서버 컴포넌트)는 Next.js가 제공하는 `cookies()` 함수로 요청에 담긴 쿠키를 읽어야 합니다. Supabase는 "로그인했는지 여부"를 쿠키에 저장된 세션 토큰으로 판단하기 때문에, 서버에서도 그 쿠키를 읽을 수 있어야 "이 요청을 보낸 사람이 로그인한 사람인지"를 알 수 있습니다.

`setAll`을 `try/catch`로 감싼 이유: Next.js의 Server Component는 화면을 그리는 도중에는 쿠키를 *쓸 수 없습니다* (읽기만 가능). 그런데 Supabase 라이브러리는 세션이 만료되면 자동으로 갱신하면서 쿠키에 새로 쓰려고 시도합니다. Server Component에서 이 시도가 발생하면 에러가 나기 때문에, 일단 에러를 무시하도록 처리했습니다 (실제 쿠키 쓰기는 아래에서 설명할 미들웨어가 대신 처리해줍니다).

> **트러블슈팅 경험담**: 처음에는 이 try/catch가 없어서, 로그인 화면을 빼고 모든 페이지가 404 에러를 뿜었습니다. 원인 분석 결과 "Server Component에서 쿠키 쓰기 시도 → 예외 발생 → 페이지 렌더링 전체 실패"였던 것이고, try/catch로 그 예외를 무시하게 만들자 바로 해결됐습니다.

---

## 5. 미들웨어 — 페이지 진입을 막는 관문

`middleware.ts`는 **모든 페이지 요청이 실제로 처리되기 전에 가장 먼저 실행되는 코드**입니다. 여기서 "로그인 안 했으면 로그인 페이지로 쫓아내기"를 처리합니다.

```typescript
// middleware.ts
// 로그인 안 한 사용자가 보호된 페이지에 접근하면 /login으로 리디렉트

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 로그인 안 됐고, 보호된 경로라면 → /login 으로 이동
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 이미 로그인 됐는데 /login 접근 → /dashboard 로 이동
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // 미들웨어가 실행될 경로 (정적 파일 등 제외)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 한 줄씩 뜯어보기

- **`NextResponse.next({ request })`**: "일단 원래 요청한 페이지로 그냥 진행시켜라"라는 의미의 응답 객체를 미리 만들어 둡니다. 나중에 리다이렉트가 필요 없다고 판단되면 이걸 그대로 반환합니다.
- **`supabase.auth.getUser()`**: 현재 요청에 담긴 쿠키(로그인 세션)를 보고, 로그인된 사용자 정보를 가져옵니다. 로그인 안 했으면 `user`가 `null`입니다.
- **`request.nextUrl.pathname.startsWith("/login")`**: 지금 요청한 주소가 `/login`으로 시작하는지 확인. 로그인 페이지 자체는 보호하면 안 되니까(로그인 안 한 사람도 로그인 페이지는 봐야 함) 예외처리합니다.
- **`url.clone()`**: 현재 요청 주소 객체를 복사해서, 그 복사본의 `pathname`만 바꿔서 새 목적지를 만듦.
- **`NextResponse.redirect(url)`**: 브라우저에게 "다른 주소로 다시 가라"고 응답함 (HTTP 302 리다이렉트).
- **`config.matcher`**: 이 미들웨어가 어떤 경로에 대해서만 실행될지 정규식으로 지정. `_next/static`(Next.js 내부 파일), 이미지 파일 확장자들은 검사할 필요가 없으니 제외합니다. (안 그러면 모든 이미지 요청마다 불필요하게 DB에 로그인 여부를 물어보게 됩니다.)

**미들웨어가 하는 일을 한 문장으로**: "사용자가 어떤 페이지든 요청하면, 가장 먼저 미들웨어가 가로채서 로그인 여부를 확인하고, 필요하면 다른 곳으로 보내버린다."

---

## 6. 로그인 화면 전체 코드

```tsx
"use client";
// app/login/page.tsx
// 로그인 & 회원가입 화면

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Ship, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // "login" 또는 "signup" 탭 전환
  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [message, setMessage]   = useState("");

  // ── 로그인 처리 ──────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  }

  // ── 회원가입 처리 ─────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("가입 완료! 이메일 인증 후 로그인해 주세요.");
      setMode("login");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* 로고 & 타이틀 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Ship className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">선박 품질검사 시스템</h1>
          <p className="text-slate-400 mt-1 text-sm">AI 기반 부품 품질 검사 플랫폼</p>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* 탭 */}
          <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
            <button
              onClick={() => { setMode("login"); setError(""); setMessage(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "signup"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              회원가입
            </button>
          </div>

          {/* 에러/성공 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {message}
            </div>
          )}

          {/* 폼 */}
          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">

            {/* 이름 (회원가입 시만) */}
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="inspector@shipyard.com"
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "로그인" : "가입하기"}
            </button>
          </form>

          {/* 하단 안내 */}
          {mode === "login" && (
            <p className="text-center text-xs text-slate-400 mt-4">
              계정이 없으신가요?{" "}
              <button
                onClick={() => setMode("signup")}
                className="text-blue-600 hover:underline font-medium"
              >
                회원가입
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2025 선박 품질검사 시스템 · AI 기반 검사 플랫폼
        </p>
      </div>
    </div>
  );
}
```

### 핵심 부분 뜯어보기

#### `"use client";`
파일 맨 첫 줄. 이 페이지는 `useState`로 입력값을 관리하고 버튼 클릭에 반응해야 하므로 Client Component로 선언했습니다.

#### `const [mode, setMode] = useState<"login" | "signup">("login");`
**useState**는 React에서 "이 컴포넌트가 기억해야 하는 값(상태)"을 만드는 기본 함수입니다. `useState(초기값)`을 호출하면 `[현재값, 값을바꾸는함수]` 두 개를 배열로 돌려줍니다.

- `mode`: 지금 화면이 "로그인 탭"인지 "회원가입 탭"인지 기억하는 값. 타입은 `"login" | "signup"`(둘 중 하나만 가능한 타입, **유니온 타입**이라고 부릅니다)
- `setMode("signup")`을 호출하면 `mode`가 `"signup"`으로 바뀌고, 화면이 다시 그려집니다(리렌더링).

이게 React의 핵심 동작 방식입니다: **상태(state)가 바뀌면 화면이 자동으로 다시 그려진다.** 우리가 직접 "이 부분을 다시 그려라"라고 명령할 필요가 없습니다.

#### `await supabase.auth.signInWithPassword({ email, password })`
Supabase가 제공하는 로그인 함수입니다. 이메일/비밀번호를 보내면, Supabase 서버가 맞는지 검증하고, 맞으면 로그인 세션(쿠키)을 만들어줍니다. `await`는 "이 작업이 끝날 때까지 기다린다"는 뜻으로, 네트워크 요청처럼 시간이 걸리는 작업(비동기 작업) 앞에 붙입니다.

#### `router.push("/dashboard"); router.refresh();`
- `router.push(주소)`: 그 주소로 화면을 이동시킵니다 (페이지 전체를 새로 불러오지 않고, 필요한 부분만 바꿔서 빠르게 이동 — 이걸 **클라이언트 사이드 네비게이션**이라 합니다)
- `router.refresh()`: 현재 보고 있는 페이지의 **서버 데이터를 다시 가져오라**는 명령. 로그인 직후에는 "로그인 안 한 상태"로 캐시된 화면이 남아있을 수 있어서, 새로 고침을 강제로 한 번 해줍니다.

#### `supabase.auth.signUp({ email, password, options: { data: { name } } })`
회원가입 함수. `options.data`에 넣은 값은 `auth.users`의 `raw_user_meta_data`라는 칼럼에 JSON으로 저장됩니다 — 앞서 01번 글에서 본 트리거 함수가 바로 이 값을 읽어서 `public.users.name`에 넣어줬던 것입니다.

#### 조건부 렌더링: `{mode === "signup" && (...)}`
React/JSX에서 자주 쓰는 패턴입니다. `&&`(그리고) 연산자는 "왼쪽이 참이면 오른쪽 값을 그대로 반환"하는데, 이걸 이용해서 "`mode`가 `signup`일 때만 이 입력칸을 화면에 그려라"를 구현합니다. 왼쪽이 거짓(false)이면 아무것도 렌더링하지 않습니다.

---

## 7. 로그인한 사용자만 보는 화면 — 레이아웃 패턴

대시보드, 선박관리 등 로그인이 필요한 페이지들은 전부 같은 패턴을 씁니다. 각 폴더에 `layout.tsx`를 둬서, 그 폴더 하위의 모든 페이지에 공통으로 적용되는 "틀"을 만듭니다.

```tsx
// app/dashboard/layout.tsx
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userEmail={user.email} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
```

### 뜯어보기

- **`export default async function`**: 이 컴포넌트는 `async`(비동기) 함수입니다. Server Component는 함수 자체를 `async`로 선언해서 그 안에서 바로 `await`로 데이터를 가져올 수 있습니다 — Client Component에서는 이게 불가능합니다 (그래서 Client Component는 `useEffect` 안에서 데이터를 가져와야 합니다).
- **`redirect("/login")`**: Next.js가 제공하는 함수로, 서버에서 즉시 다른 페이지로 보내버립니다. 미들웨어와 비슷한 역할을 여기서도 한 번 더 하는 셈인데, 이렇게 **이중으로 체크**하는 게 보안상 안전합니다 (미들웨어 설정을 실수로 빼먹어도 레이아웃에서 한 번 더 막아주니까).
- **`{ children }: { children: React.ReactNode }`**: 이 레이아웃 "안에 들어갈 실제 페이지 내용"을 `children`이라는 이름으로 받습니다. 예를 들어 `/dashboard` 페이지에 접속하면, `app/dashboard/page.tsx`의 내용이 이 `children` 자리에 끼워져서 최종 화면이 완성됩니다.

```
[DashboardLayout]
 ├─ Sidebar (왼쪽 메뉴, 모든 페이지 공통)
 ├─ Header (위쪽 헤더, 모든 페이지 공통)
 └─ {children} ← 여기에 page.tsx의 내용이 끼워짐
```

이 구조의 장점: 사이드바/헤더/로그인 체크를 매 페이지마다 복사+붙여넣기 안 해도, 레이아웃 파일 하나로 그 하위 모든 페이지에 자동 적용됩니다.

---

## 8. 사이드바 메뉴 — 현재 페이지 강조 표시

```tsx
"use client";
// components/layout/Sidebar.tsx
// 좌측 네비게이션 사이드바

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  Ship, LayoutDashboard, Anchor, Layers,
  ClipboardList, BarChart3, LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",    label: "대시보드",    icon: LayoutDashboard },
  { href: "/ships",        label: "선박 관리",   icon: Anchor },
  { href: "/blocks",       label: "블록 관리",   icon: Layers },
  { href: "/inspections/new", label: "검사 요청", icon: Ship },
  { href: "/inspections",  label: "검사 이력",   icon: ClipboardList },
  { href: "/statistics",   label: "통계",        icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 min-h-screen bg-slate-900 flex flex-col">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Ship className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">선박 품질검사</p>
          <p className="text-slate-400 text-xs">AI Inspection System</p>
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/inspections/new"
              ? pathname === "/inspections/new"
              : href === "/inspections"
              ? pathname === "/inspections" || (pathname.startsWith("/inspections/") && pathname !== "/inspections/new")
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
```

### 뜯어보기

- **`usePathname()`**: 현재 브라우저 주소(예: `/inspections/new`)를 문자열로 가져오는 Next.js Hook. 이 값을 메뉴 항목의 `href`와 비교해서 "지금 이 메뉴를 보고 있는지"를 판단합니다.
- **`navItems.map(...)`**: 메뉴 배열을 하나씩 돌면서 `<Link>` 컴포넌트를 만듭니다. React에서 "같은 모양의 UI를 여러 번 반복해서 그릴 때" 가장 흔히 쓰는 패턴이 배열의 `.map()`입니다.
- **`isActive` 계산이 복잡한 이유**: 메뉴에 `/inspections`(검사 이력)와 `/inspections/new`(검사 요청) 두 개가 있는데, 단순히 `pathname.startsWith(href)`로만 체크하면 `/inspections/new`에 있을 때 `href="/inspections"`도 `startsWith` 조건을 만족해버려서 **두 메뉴가 동시에 활성화되는 버그**가 생깁니다. 그래서 `/inspections/new`는 정확히 일치(`===`)하는지만 보고, `/inspections`는 "정확히 `/inspections`이거나, `/inspections/`로 시작하면서 `/inspections/new`는 아닌 경우"로 조건을 분리했습니다.

  > 실제로 이 프로젝트에서 처음엔 단순 `startsWith`로만 만들었다가 "검사요청 눌렀는데 검사이력도 같이 하이라이트된다"는 버그를 만났고, 위처럼 조건을 분리해서 고쳤습니다. **이런 "메뉴 항목들의 경로가 서로의 접두사(prefix)인 경우"는 사이드바를 만들 때 흔히 만나는 버그**이니 기억해두면 좋습니다.

- **`supabase.auth.signOut()`**: 로그인 세션(쿠키)을 지워서 로그아웃 처리.

---

## 9. 정리

이번 글의 핵심 개념:

- **App Router**: 폴더 구조 = URL 구조
- **Server Component vs Client Component**: 기본은 서버, 상호작용이 필요하면 `"use client"`
- **미들웨어**: 모든 요청을 가로채서 로그인 여부로 리다이렉트하는 관문
- **레이아웃(`layout.tsx`)**: 여러 페이지에 공통으로 적용되는 틀 (사이드바, 헤더, 인증 체크)
- **useState**: 컴포넌트가 기억하는 값. 바뀌면 화면이 자동으로 다시 그려짐
- **조건부 렌더링**: `{조건 && <컴포넌트/>}` 패턴

다음 글(03)에서는 선박/블록을 등록·조회·수정·삭제하는 화면을 만들면서 **CRUD 패턴**을 배워보겠습니다.
