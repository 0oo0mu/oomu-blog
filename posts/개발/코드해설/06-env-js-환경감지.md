---
title: "[코드 해설 06] env.js — 로컬인가 배포인가"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, 환경설정]
excerpt: 같은 코드가 내 컴퓨터에서는 에디터를 보여주고, 배포된 사이트에서는 숨깁니다. 실행 환경을 감지하는 방법을 설명합니다.
---

## 이 파일이 하는 일

내 컴퓨터에서 블로그를 열면 헤더에 **"글쓰기"** 버튼이 보입니다.  
하지만 GitHub Pages에 배포된 사이트에서는 그 버튼이 없어요.

같은 코드인데 어떻게 다르게 동작할까요?  
`env.js`가 현재 실행 환경을 감지하기 때문입니다.

---

## 전체 코드

```javascript
const Env = {
  isLocal: ['localhost', '127.0.0.1', ''].includes(window.location.hostname),

  get name() {
    return this.isLocal ? 'local' : 'web';
  },

  get baseUrl() {
    return window.location.origin;
  },
};
```

짧지만 핵심적인 파일입니다.

---

## isLocal — 로컬 환경 감지

```javascript
isLocal: ['localhost', '127.0.0.1', ''].includes(window.location.hostname),
```

**한 줄씩 설명:**

`window.location.hostname`  
→ 현재 접속한 주소의 **도메인 부분**을 가져옵니다.

| 접속 방법 | hostname 값 |
|----------|------------|
| `http://localhost:3000` 로 접속 | `'localhost'` |
| `http://127.0.0.1:3000` 로 접속 | `'127.0.0.1'` |
| `file:///C:/Blog/index.html` 파일로 열기 | `''` (빈 문자열) |
| `https://0oo0mu.github.io/oomu-blog` | `'0oo0mu.github.io'` |

`['localhost', '127.0.0.1', ''].includes(...)`  
→ 배열 안에 해당 값이 있으면 `true`, 없으면 `false`  
세 가지 로컬 환경을 한꺼번에 처리합니다.

이 값은 **한 번만 계산**됩니다. 페이지 로드 시 즉시 실행되어 `isLocal`에 저장돼요.

---

## get name() — 환경 이름

```javascript
get name() {
  return this.isLocal ? 'local' : 'web';
},
```

`get`은 **getter**입니다. 함수이지만 속성처럼 접근합니다.

```javascript
// 함수처럼 호출 (X)
Env.name()

// 속성처럼 접근 (O)
Env.name // 'local' 또는 'web'
```

---

## get baseUrl() — 기준 URL

```javascript
get baseUrl() {
  return window.location.origin;
},
```

`window.location.origin`  
→ 프로토콜 + 도메인 + 포트를 반환합니다.

| 접속 주소 | origin 값 |
|----------|----------|
| `http://localhost:3000/index.html` | `'http://localhost:3000'` |
| `https://0oo0mu.github.io/oomu-blog/` | `'https://0oo0mu.github.io'` |

---

## 실제 사용 예시

```javascript
// app-index.js에서
import Env from './core/env.js';

// 로컬일 때만 글쓰기 버튼 표시
const writeBtn = document.getElementById('writeBtn');
if (writeBtn) {
  writeBtn.style.display = Env.isLocal ? 'flex' : 'none';
}
```

---

## 왜 이 방식이 좋은가?

이 방법은 서버 없이도 환경을 구분할 수 있습니다.  
Node.js의 `process.env.NODE_ENV`처럼 빌드 설정이 필요 없어요.  
브라우저가 알려주는 주소 정보만으로 로컬/배포를 구분합니다.
