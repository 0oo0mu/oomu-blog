---
title: "[코드 해설 06] env.js — 로컬인가 배포인가"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, 환경설정]
excerpt: 내 컴퓨터에서 실행 중인지, 인터넷에 배포된 것인지 감지해서 에디터 버튼을 보이거나 숨기는 간단하지만 중요한 파일입니다.
---

# env.js — 로컬인가 배포인가

## 왜 필요한가

이 블로그에는 글 작성 에디터가 있습니다. 그런데 에디터 버튼을 인터넷에 배포한 블로그에서도 보이면 곤란합니다. 방문자가 글을 마음대로 쓸 수는 없으니까요.

그래서 **로컬(내 컴퓨터)**에서 실행 중일 때만 에디터 버튼을 보여주고, **배포된 웹**에서는 숨깁니다.

이 구분을 하는 파일이 `env.js`입니다.

---

## 전체 코드

```js
const Env = {
  isLocal: ['localhost', '127.0.0.1', ''].includes(window.location.hostname),

  get name() {
    return this.isLocal ? 'local' : 'web';
  },

  get baseUrl() {
    return window.location.origin;
  },
};

export default Env;
```

---

## 한 줄씩 설명

### `isLocal` — 로컬 환경 판별

```js
isLocal: ['localhost', '127.0.0.1', ''].includes(window.location.hostname),
```

**`window.location.hostname`**
현재 페이지의 도메인 이름입니다.

| 상황 | `hostname` 값 |
|---|---|
| `http://localhost:3000` | `'localhost'` |
| `http://127.0.0.1:5500` | `'127.0.0.1'` |
| `file:///C:/blog/index.html` | `''` (빈 문자열) |
| `https://myblog.netlify.app` | `'myblog.netlify.app'` |

**`['localhost', '127.0.0.1', ''].includes(...)`**
배열에 해당 값이 포함되어 있으면 `true`, 없으면 `false`.
로컬 환경의 세 가지 경우(`localhost`, `127.0.0.1`, 빈 문자열)에 해당하면 `isLocal = true`.

이 줄은 객체 선언 시 즉시 실행되어 `isLocal`이 `true` 또는 `false`로 고정됩니다.

---

### `get name()` — 환경 이름

```js
get name() {
  return this.isLocal ? 'local' : 'web';
},
```

`get`은 게터(Getter)입니다. 함수인데 `()`없이 속성처럼 접근합니다.

```js
Env.name   // 'local' 또는 'web' 반환 (괄호 없이!)
Env.name() // 오류! 함수 호출 방식으로 쓰면 안 됨
```

---

### `get baseUrl()` — 사이트 기준 URL

```js
get baseUrl() {
  return window.location.origin;
},
```

`window.location.origin`은 `프로토콜 + 도메인 + 포트`입니다.

| 상황 | `origin` 값 |
|---|---|
| `http://localhost:3000/index.html` | `'http://localhost:3000'` |
| `https://myblog.netlify.app/post.html` | `'https://myblog.netlify.app'` |

절대 URL을 만들 때 유용합니다.

---

## 실제 사용 예시

```js
// 헤더에서 에디터 버튼 표시 여부 결정
import Env from './env.js';

const writeBtn = document.getElementById('writeBtn');
if (writeBtn) {
  writeBtn.style.display = Env.isLocal ? 'flex' : 'none';
}
```

로컬이면 보이고, 배포 환경이면 숨깁니다.

---

## 다음 파일

- **[07] posts-loader.js** — 게시글 목록 데이터 불러오기
