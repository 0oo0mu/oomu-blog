---
title: "[코드 해설 01] app.js — 모듈들의 우체국"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, 설계, 이벤트]
excerpt: 블로그의 모든 기능이 서로 소통하는 방법. 이벤트 버스와 모듈 레지스트리를 한 줄씩 파헤칩니다.
---

## 이 파일이 하는 일

`app.js`는 두 가지 역할을 합니다:

1. **모듈 등록** — 각 기능(검색, 사이드바, 음악 등)을 등록하고 초기화
2. **이벤트 버스** — 모듈끼리 직접 연락하지 않고 app.js를 통해 소통

---

## 왜 이게 필요할까?

검색창(`search.js`)이 검색어를 받으면, 카드 목록(`renderer.js`)이 필터링된 결과를 보여줘야 합니다.

**나쁜 방법:**
```javascript
// search.js 안에서 직접 renderer를 가져와서 호출
import Renderer from './renderer.js';
Renderer.render(filteredPosts);
```

이렇게 하면 search.js가 renderer.js에 **직접 의존**하게 됩니다.  
나중에 renderer를 수정하거나 없애면 search.js도 같이 고쳐야 해요.

**좋은 방법 (이 블로그 방식):**
```javascript
// search.js는 그냥 소식만 전달
App.emit('filter:search', { query: '자바스크립트' });

// renderer.js는 자기가 관심 있는 소식만 구독
App.on('posts:filtered', ({ posts }) => {
  // 카드 그리기
});
```

search.js와 renderer.js가 서로 모릅니다. app.js만 알면 돼요.

---

## 전체 코드

```javascript
const App = {
  modules: {},      // 등록된 모듈들 저장
  _listeners: {},   // 이벤트 리스너들 저장

  register(name, module) { ... },
  emit(event, data) { ... },
  on(event, cb) { ... },
  get(name) { ... },
};
```

---

## register() — 모듈 등록

```javascript
register(name, module) {
  this.modules[name] = module;       // 모듈을 이름으로 저장
  if (typeof module.init === 'function') {
    module.init();                   // init 함수가 있으면 자동 실행
  }
},
```

**한 줄씩 설명:**

`this.modules[name] = module;`  
→ `modules`라는 상자에 모듈을 넣습니다. 예: `modules['search'] = SearchModule`

`if (typeof module.init === 'function')`  
→ "init이라는 함수가 있냐?"를 확인합니다. `typeof`는 타입(종류)을 알려주는 키워드예요.

`module.init()`  
→ 있으면 바로 실행합니다. 각 모듈의 초기화 함수가 자동으로 호출돼요.

**사용 예시 (app-index.js에서):**
```javascript
App.register('search', Search);   // Search.init() 자동 호출
App.register('sidebar', Sidebar); // Sidebar.init() 자동 호출
```

---

## emit() — 이벤트 발행 (소식 보내기)

```javascript
emit(event, data) {
  const listeners = this._listeners[event] || [];
  listeners.forEach(cb => {
    try {
      cb(data);
    } catch (e) {
      console.error(`[App] 이벤트 핸들러 오류 (${event}):`, e);
    }
  });
},
```

**한 줄씩 설명:**

`const listeners = this._listeners[event] || [];`  
→ 이 이벤트를 구독한 함수들을 가져옵니다.  
구독한 게 없으면 `undefined`가 되는데, `|| []`로 빈 배열로 대체합니다.

`listeners.forEach(cb => { cb(data); })`  
→ 구독한 함수들을 하나씩 실행합니다.  
`forEach`는 "배열의 각 항목에 대해 이 작업을 해라"는 뜻이에요.

`try { ... } catch (e) { ... }`  
→ 실행 중 오류가 나도 다른 구독자는 계속 실행됩니다. 하나가 터져도 나머지는 괜찮아요.

**사용 예시:**
```javascript
// posts-loader.js에서 게시글 로드 후
App.emit('posts:loaded', { posts: [...] });
// → sidebar, filter, renderer 등 구독자들이 모두 실행됨
```

---

## on() — 이벤트 구독 (소식 받기)

```javascript
on(event, cb) {
  if (!this._listeners[event]) {
    this._listeners[event] = [];
  }
  this._listeners[event].push(cb);

  return () => {
    this._listeners[event] = this._listeners[event].filter(fn => fn !== cb);
  };
},
```

**한 줄씩 설명:**

`if (!this._listeners[event]) { this._listeners[event] = []; }`  
→ 이 이벤트에 대한 목록이 없으면 빈 배열을 만듭니다.  
처음 구독자가 등록될 때 자리를 만드는 거예요.

`this._listeners[event].push(cb);`  
→ 구독 함수를 목록에 추가합니다.  
`push`는 배열의 맨 끝에 항목을 추가하는 메서드예요.

`return () => { ... };`  
→ **구독 해제 함수**를 반환합니다. 나중에 이 함수를 호출하면 구독이 취소돼요.

`this._listeners[event].filter(fn => fn !== cb)`  
→ 내 함수(`cb`)를 제외한 나머지 함수들만 남깁니다.  
`filter`는 "조건에 맞는 것만 남겨라"는 배열 메서드예요.

**사용 예시:**
```javascript
// sidebar.js에서
App.on('posts:loaded', ({ posts }) => {
  this._build(posts); // 게시글 목록으로 카테고리 트리 만들기
});
```

---

## get() — 모듈 가져오기

```javascript
get(name) {
  return this.modules[name];
},
```

등록된 모듈을 이름으로 꺼내 씁니다.  
```javascript
const sidebar = App.get('sidebar');
```

---

## 정리

| 함수 | 역할 | 비유 |
|------|------|------|
| `register()` | 모듈 등록 + 초기화 | 직원 입사 |
| `emit()` | 이벤트 발행 | 사내 방송 |
| `on()` | 이벤트 구독 | 방송 채널 신청 |
| `get()` | 모듈 조회 | 직원 명부 조회 |

이 4가지 함수만으로 15개의 모듈이 서로 소통합니다.
