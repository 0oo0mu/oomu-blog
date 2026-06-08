---
title: "[코드 해설 07] posts-loader.js — 게시글 목록 불러오기"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, fetch, async/await]
excerpt: fetch로 posts.json을 불러오고, 날짜 순으로 정렬해서 이벤트로 알려주는 로더. async/await와 캐싱 패턴을 한 줄씩 설명합니다.
---

# posts-loader.js — 게시글 목록 불러오기

## 이 파일이 하는 일

블로그 목록 화면에 카드들이 뜨려면 어딘가에서 "어떤 글들이 있나" 데이터를 가져와야 합니다.
그 데이터가 `posts/posts.json`이고, 이 파일이 그걸 가져오는 역할을 합니다.

`posts.json` 예시:
```json
[
  {
    "file": "개발/hello-world.md",
    "title": "첫 번째 글",
    "date": "2026-06-01",
    "category": "개발",
    "tags": ["JavaScript"],
    "excerpt": "안녕하세요, 첫 번째 글입니다."
  },
  ...
]
```

---

## 전체 코드

```js
import App from '../core/app.js';

let _cache = null;

const PostsLoader = {
  async load() {
    if (_cache) {
      App.emit('posts:loaded', { posts: _cache });
      return _cache;
    }

    try {
      const res = await fetch('posts/posts.json');
      if (!res.ok) throw new Error(`posts.json 불러오기 실패: HTTP ${res.status}`);

      const posts = await res.json();

      posts.sort((a, b) => new Date(b.date) - new Date(a.date));

      _cache = posts;
      App.emit('posts:loaded', { posts });
      return posts;

    } catch (error) {
      console.error('[PostsLoader]', error);
      App.emit('posts:error', { error });
      throw error;
    }
  },

  clearCache() {
    _cache = null;
  },
};

export default PostsLoader;
```

---

## 한 줄씩 설명

### 캐시 변수

```js
let _cache = null;
```

`let`은 나중에 값을 바꿀 수 있는 변수입니다 (const는 못 바꿈).
이 변수는 **모듈 스코프**에 있습니다. PostsLoader 객체 밖에 있지만 이 파일 안에서는 쓸 수 있습니다.

초기값은 `null` (아직 데이터가 없다는 뜻).
한 번 로드하면 여기 저장해두고, 다음 호출에서는 다시 fetch하지 않고 이걸 씁니다.

---

### `async load()` — 비동기 로드

```js
async load() {
```

`async`가 붙으면 이 함수는 비동기 함수입니다.
비동기란 "기다리는 동안 다른 일을 할 수 있다"는 뜻입니다.

인터넷에서 데이터를 가져오는 건 시간이 걸립니다. 그 동안 페이지가 멈추면 안 됩니다.
`async/await`를 쓰면 기다리는 동안 다른 작업이 가능합니다.

---

### 캐시 확인

```js
if (_cache) {
  App.emit('posts:loaded', { posts: _cache });
  return _cache;
}
```

`_cache`가 null이 아니면(= 이미 로드한 적 있으면) 저장해둔 데이터를 그대로 씁니다.
같은 페이지에서 목록을 여러 번 볼 때도 네트워크 요청을 딱 한 번만 합니다.

---

### `fetch` — 데이터 가져오기

```js
const res = await fetch('posts/posts.json');
```

`fetch`는 URL에서 데이터를 가져오는 브라우저 내장 함수입니다.
`await`는 "가져올 때까지 기다려"라는 뜻입니다.
`res`(response)에는 서버의 응답 전체가 담깁니다.

```js
if (!res.ok) throw new Error(`posts.json 불러오기 실패: HTTP ${res.status}`);
```

`res.ok`는 HTTP 상태코드가 200~299 범위일 때 `true`입니다.
파일이 없으면 404, 서버 오류면 500 같은 코드가 옵니다. 이때 `ok`가 `false`.
`throw new Error(...)`는 오류를 발생시킵니다. 아래의 `catch`로 이동합니다.

```js
const posts = await res.json();
```

응답 내용을 JSON으로 파싱합니다. 문자열 `'[{...}]'`을 자바스크립트 배열로 변환합니다.
이것도 시간이 약간 걸리므로 `await`를 씁니다.

---

### 날짜 정렬

```js
posts.sort((a, b) => new Date(b.date) - new Date(a.date));
```

`sort`는 배열을 정렬하는 함수입니다.
콜백 함수 `(a, b) => ...`의 반환값이:
- 양수면 a를 b 뒤로
- 음수면 a를 b 앞으로
- 0이면 순서 유지

`new Date('2026-06-02') - new Date('2026-01-01')`은 날짜 차이(밀리초)입니다.
`b.date - a.date`는 최신 날짜(큰 값)가 먼저 오는 **내림차순** 정렬입니다.

---

### 캐시 저장 & 이벤트 발행

```js
_cache = posts;
App.emit('posts:loaded', { posts });
return posts;
```

정렬된 포스트 배열을 캐시에 저장하고, `posts:loaded` 이벤트를 발행합니다.
이 이벤트를 기다리는 filter.js, sidebar.js, renderer.js 등이 자동으로 반응합니다.

`{ posts }`는 `{ posts: posts }`의 축약 표현입니다. 키와 변수명이 같으면 줄여 쓸 수 있습니다.

---

### 오류 처리

```js
} catch (error) {
  console.error('[PostsLoader]', error);
  App.emit('posts:error', { error });
  throw error;
}
```

`fetch`나 `res.json()` 과정에서 오류가 나면 여기로 옵니다.
오류를 콘솔에 출력하고, `posts:error` 이벤트를 발행합니다.
`throw error`는 오류를 다시 던져서 호출한 쪽에서도 처리할 수 있게 합니다.

---

## 흐름 정리

```
PostsLoader.load() 호출
   │
   ├─ 캐시 있으면 → App.emit('posts:loaded') → 완료
   │
   └─ 캐시 없으면
         │
         ▼
      fetch('posts/posts.json') 요청
         │
         ▼
      날짜 내림차순 정렬
         │
         ▼
      _cache 저장
         │
         ▼
      App.emit('posts:loaded', { posts })
         │
         ├──▶ Filter.js: 태그 칩 생성 + 첫 필터링
         ├──▶ Sidebar.js: 카테고리 트리 생성
         └──▶ (Renderer.js는 posts:filtered 이벤트 대기)
```

---

## 다음 파일

- **[08] filter.js** — 카테고리·태그·검색어를 합쳐서 포스트 걸러내기
