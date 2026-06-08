---
title: "[코드 해설 01] app.js — 모듈들의 우체국"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, 설계, 이벤트]
excerpt: 블로그의 모든 기능이 서로 소통하는 방법. 이벤트 버스와 모듈 레지스트리를 한 줄씩 파헤칩니다.
---

# app.js — 모듈들의 우체국

## 이 파일이 하는 일

이 블로그에는 여러 기능이 있습니다. 검색, 필터, 사이드바, 뮤직 플레이어, 다크모드… 이 기능들이 서로 정보를 주고받아야 합니다.

예를 들어, 사이드바에서 "PC" 카테고리를 클릭하면 → 카드 목록이 PC 관련 글만 보여줘야 합니다.

이때 두 가지 방법이 있습니다.

**방법 1 (나쁜 방법):** 사이드바가 카드 목록을 직접 import해서 조작한다.
```
sidebar.js ──import──▶ renderer.js ──import──▶ filter.js
```
문제: 이 방법은 파일들이 서로 얽혀서, 하나를 바꾸면 다른 것들도 다 수정해야 합니다.

**방법 2 (좋은 방법, 이 블로그 방식):** 우체국(App)을 통해 편지(이벤트)를 주고받는다.
```
sidebar.js ──편지 발송──▶ App(우체국) ──편지 배달──▶ filter.js
```
이 방법은 사이드바가 "나 카테고리 바꿨어"라고 공지만 하면, 듣고 싶은 모듈이 알아서 반응합니다. 서로 직접 알 필요가 없습니다.

이 역할을 하는 파일이 `app.js`입니다.

---

## 전체 코드

```js
const App = {
  modules: {},
  _listeners: {},

  register(name, module) {
    this.modules[name] = module;
    if (typeof module.init === 'function') {
      module.init();
    }
  },

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

  on(event, cb) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(cb);
    return () => {
      this._listeners[event] = this._listeners[event].filter(fn => fn !== cb);
    };
  },

  get(name) {
    return this.modules[name];
  },
};

export default App;
```

---

## 한 줄씩 설명

### 객체 선언

```js
const App = {
```

`const`는 "이 변수는 나중에 다른 값으로 바꿀 수 없다"는 선언입니다.
`App`은 변수 이름입니다. `{}`는 객체(여러 정보를 담는 상자)를 만든다는 뜻입니다.

---

### 저장공간 두 개

```js
modules: {},
_listeners: {},
```

`modules`는 등록된 기능들을 보관하는 서랍입니다.
예시: `{ 'search': SearchModule, 'sidebar': SidebarModule }`

`_listeners`는 "어떤 이벤트가 왔을 때 누구를 불러야 하나"를 기록하는 명단입니다.
예시: `{ 'posts:loaded': [함수A, 함수B], 'theme:change': [함수C] }`

이름 앞에 `_`가 붙으면 "이건 내부용이야, 밖에서 직접 쓰지 마"라는 관례입니다.

---

### `register` — 모듈 등록

```js
register(name, module) {
  this.modules[name] = module;
  if (typeof module.init === 'function') {
    module.init();
  }
},
```

**`register(name, module)`**
함수 이름은 `register`이고, `name`과 `module` 두 가지를 받습니다.
예: `App.register('search', SearchModule)` → name='search', module=SearchModule

**`this.modules[name] = module`**
`this`는 App 자신을 가리킵니다.
`this.modules['search'] = SearchModule` 이런 식으로 서랍에 넣는 것입니다.

**`if (typeof module.init === 'function')`**
`typeof`는 "이게 어떤 종류야?"를 물어보는 것입니다.
`module.init`이 함수라면 true, 없거나 다른 타입이면 false입니다.

**`module.init()`**
모듈의 init 함수를 자동으로 실행합니다.
덕분에 `App.register('search', Search)` 한 줄만 써도 Search.init()이 자동 실행됩니다.

---

### `emit` — 이벤트 발행 (편지 발송)

```js
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

**`const listeners = this._listeners[event] || []`**
`this._listeners['posts:loaded']`처럼 이 이벤트를 구독한 함수 목록을 가져옵니다.
`|| []`는 "해당 이벤트를 구독한 사람이 없으면 빈 배열을 써라"입니다.
빈 배열이면 아래 `forEach`가 아무것도 안 하고 끝납니다. 오류가 나지 않습니다.

**`listeners.forEach(cb => { ... })`**
`forEach`는 배열의 모든 항목을 하나씩 꺼내서 실행합니다.
`cb`는 각 구독 함수입니다 (cb = callback의 줄임말).

**`try { cb(data); } catch (e) { ... }`**
`try`는 "이걸 실행해봐". `catch`는 "만약 오류가 나면 이걸 해".
하나의 구독 함수에서 오류가 나도 다른 구독 함수들은 계속 실행됩니다.

---

### `on` — 이벤트 구독 (편지 받기 신청)

```js
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

**`if (!this._listeners[event])`**
`!`는 "~이 아니면"입니다. 이 이벤트 명단이 아직 없으면 빈 배열을 만듭니다.

**`this._listeners[event].push(cb)`**
`push`는 배열 맨 뒤에 항목을 추가합니다.
"이 이벤트가 왔을 때 cb를 실행해줘"라고 등록하는 것입니다.

**`return () => { ... }`**
구독 해제 함수를 반환합니다. 이걸 나중에 호출하면 구독이 취소됩니다.

```js
const off = App.on('theme:change', handler);
// 나중에 구독 해제할 때:
off();
```

**`this._listeners[event].filter(fn => fn !== cb)`**
`filter`는 배열에서 조건을 만족하는 것만 남깁니다.
"cb랑 다른 것들만 남겨라" = cb를 제거하는 것입니다.

---

### `get` — 모듈 가져오기

```js
get(name) {
  return this.modules[name];
},
```

등록된 모듈을 이름으로 꺼냅니다.
`App.get('music')` → 뮤직 플레이어 모듈 반환.

---

### `export default App`

```js
export default App;
```

이 파일을 다른 파일에서 불러올 수 있도록 내보냅니다.
다른 파일에서 `import App from './app.js'` 라고 쓰면 이 App 객체를 쓸 수 있습니다.

---

## 실제 사용 예시

```js
// search.js — 검색어가 바뀌면 이벤트 발행
App.emit('filter:search', { query: '자바스크립트' });

// filter.js — 검색 이벤트를 구독
App.on('filter:search', ({ query }) => {
  console.log('검색어가 바뀌었어:', query);
  // 포스트 필터링 실행...
});
```

---

## 다음 파일

- **[02] router.js** — 페이지 이동 없이 화면을 바꾸는 SPA 라우터
- **[전체 연결 구조]** — 모든 모듈이 어떻게 app.js를 통해 연결되는지 한눈에 보기
