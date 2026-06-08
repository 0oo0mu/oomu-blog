---
title: "[코드 해설 07] posts-loader.js — 게시글 목록 불러오기"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, fetch, async/await]
excerpt: 블로그가 처음 열릴 때 게시글 목록을 어떻게 가져오나요? fetch, async/await, 캐싱 패턴을 설명합니다.
---

## 이 파일이 하는 일

블로그를 열면 게시글 카드들이 나타납니다.  
이 카드들의 데이터(제목, 날짜, 카테고리 등)는 `posts/posts.json` 파일에 있어요.

`posts-loader.js`는 이 파일을 가져와서 다른 모듈에 전달합니다.

---

## posts.json은 어떻게 생겼나?

```json
[
  {
    "file": "개발/코드해설/01-app-js.md",
    "title": "[코드 해설 01] app.js — 모듈들의 우체국",
    "date": "2026-06-08",
    "category": "개발/코드해설",
    "tags": ["JavaScript", "설계", "이벤트"],
    "excerpt": "블로그의 모든 기능이 서로 소통하는 방법..."
  },
  ...
]
```

`build.js`가 `posts/` 폴더를 스캔해서 이 파일을 자동 생성합니다.

---

## async/await란?

```javascript
async load() {
  const res = await fetch('posts/posts.json');
  const posts = await res.json();
}
```

**네트워크 요청은 시간이 걸립니다.** 서버에서 파일을 받아오는 동안 기다려야 해요.

`fetch(url)` → 파일 요청 시작  
`await` → 완료될 때까지 기다림 (다른 코드는 계속 실행)  
`async` → 이 함수 안에서 `await`를 쓸 수 있다는 표시

`await` 없이 쓰면 데이터가 오기 전에 다음 코드가 실행되어 오류가 납니다.

---

## 전체 코드

```javascript
let _cache = null; // 캐시 변수 (모듈 밖에 선언)

const PostsLoader = {
  async load() {
    // 캐시 있으면 재사용
    if (_cache) {
      App.emit('posts:loaded', { posts: _cache });
      return _cache;
    }

    try {
      const res = await fetch('posts/posts.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
};
```

---

## 캐싱 패턴

```javascript
let _cache = null;

if (_cache) {
  App.emit('posts:loaded', { posts: _cache });
  return _cache;
}
```

`_cache` 변수가 모듈 밖에 선언되어 있습니다.  
`load()`가 처음 실행될 때는 `null`이라서 실제 fetch를 합니다.  
두 번째 호출부터는 이미 데이터가 있으니 네트워크 요청 없이 바로 반환해요.

이것을 **캐싱(Caching)**이라고 합니다. 한 번 가져온 데이터를 다시 쓰는 거예요.

---

## fetch와 res.json()

```javascript
const res = await fetch('posts/posts.json');
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const posts = await res.json();
```

`fetch('posts/posts.json')`  
→ 파일 요청을 시작합니다. `Response` 객체를 반환해요.

`res.ok`  
→ HTTP 상태 코드가 200~299 범위면 `true`입니다.  
404(파일 없음), 500(서버 오류) 등은 `false`예요.

`if (!res.ok) throw new Error(...)`  
→ 오류 응답을 받으면 직접 에러를 발생시킵니다.  
fetch는 네트워크 연결 실패만 에러를 던지고, 404는 에러로 처리 안 해요. 그래서 직접 처리해야 합니다.

`res.json()`  
→ 응답 본문을 JSON으로 파싱합니다. 이것도 비동기라서 `await`가 필요해요.

---

## 날짜 정렬

```javascript
posts.sort((a, b) => new Date(b.date) - new Date(a.date));
```

`sort`는 배열을 정렬하는 메서드입니다.  
비교 함수가 양수면 b가 앞, 음수면 a가 앞이에요.

`new Date(b.date) - new Date(a.date)`  
→ 날짜를 숫자(밀리초)로 변환해서 뺍니다.  
b가 더 최신이면 양수 → b가 앞 → 최신 글이 먼저 나와요.

---

## 이벤트 발행

```javascript
App.emit('posts:loaded', { posts });
```

데이터 로드 완료 후 다른 모듈들에게 알립니다.  
`sidebar.js`, `filter.js`, `renderer.js`가 모두 이 이벤트를 기다리고 있어요.  
이 이벤트 하나로 세 모듈이 동시에 초기화됩니다.
