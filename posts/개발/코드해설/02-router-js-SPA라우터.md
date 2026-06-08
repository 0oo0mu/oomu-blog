---
title: "[코드 해설 02] router.js — 음악이 끊기지 않는 페이지 이동"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, SPA, 라우터]
excerpt: 페이지를 이동하지 않고 화면만 바꾸는 SPA 라우터. history.pushState와 이벤트 위임을 한 줄씩 파헤칩니다.
---

# router.js — 음악이 끊기지 않는 페이지 이동

## 왜 이 파일이 필요한가

이 블로그에는 하단에 뮤직 플레이어가 있습니다.
보통 방식으로 글 목록 → 글 상세 페이지를 이동하면, 브라우저가 새 HTML 파일을 처음부터 로드합니다. 이때 `<audio>` 태그도 사라지고 **음악이 끊깁니다.**

해결책: **실제로 페이지를 이동하지 않고**, URL만 바꾸고 화면 내용만 교체합니다.
이런 방식을 SPA(Single Page Application)라고 부릅니다.

```
[일반 방식]
index.html → (완전히 새로 로드) → post.html
결과: 음악 끊김 ❌

[SPA 방식]
index.html 안에서 #listView 숨기고 #postView 보여주기
URL만 ?file=... 로 변경
결과: 음악 계속 재생 ✅
```

---

## HTML 구조 이해

router.js를 이해하려면 먼저 index.html 구조를 알아야 합니다.

```html
<div id="listView">   ← 글 목록 화면
  ...카드들...
</div>

<div id="postView">   ← 글 상세 화면
  ...글 내용...
</div>
```

두 화면이 같은 HTML 파일 안에 공존합니다. `view-hidden` 클래스를 붙이고 떼면서 하나만 보여줍니다.

---

## 전체 코드

```js
import App from './app.js';

const Router = {
  _savedScrollY: 0,

  init() {
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    if (file) {
      this._applyView('post', { file }, false);
    } else {
      this._applyView('list', {}, false);
    }

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.post-card[data-file]');
      if (card) {
        e.preventDefault();
        this.goPost(card.dataset.file);
        return;
      }
      if (e.target.closest('#backBtn')) {
        e.preventDefault();
        this.goList();
      }
    });

    window.addEventListener('popstate', (e) => {
      const state = e.state || { view: 'list' };
      this._applyView(state.view, state, false);
    });
  },

  goPost(file) {
    this._savedScrollY = window.scrollY;
    history.pushState({ view: 'post', file }, '', `?file=${encodeURIComponent(file)}`);
    this._applyView('post', { file }, true);
  },

  goList() {
    history.pushState({ view: 'list' }, '', 'index.html');
    this._applyView('list', {}, true);
  },

  _applyView(view, data, scroll) {
    const listEl = document.getElementById('listView');
    const postEl = document.getElementById('postView');

    if (view === 'post') {
      listEl?.classList.add('view-hidden');
      postEl?.classList.remove('view-hidden');
      App.emit('router:post', { file: data.file });
      if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      postEl?.classList.add('view-hidden');
      listEl?.classList.remove('view-hidden');
      App.emit('router:list', {});
      if (scroll) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: this._savedScrollY, behavior: 'instant' });
        });
      }
    }
  },
};

export default Router;
```

---

## 한 줄씩 설명

### 불러오기

```js
import App from './app.js';
```

[01] app.js에서 만든 App 객체를 가져옵니다. 이벤트를 발행할 때 씁니다.

---

### 스크롤 위치 저장

```js
_savedScrollY: 0,
```

글 목록을 스크롤하다가 글을 클릭했을 때, 뒤로가기 하면 이전 스크롤 위치로 돌아와야 합니다.
그 위치를 여기 저장합니다. 초기값은 0 (맨 위)입니다.

---

### `init` — 초기화

#### URL 파라미터 확인

```js
const params = new URLSearchParams(window.location.search);
```

`window.location.search`는 URL의 `?` 이후 부분입니다.
예: URL이 `index.html?file=hello.md` 라면 → `?file=hello.md` 를 가져옵니다.

`URLSearchParams`는 이 문자열을 파싱하는 도구입니다.

```js
const file = params.get('file');
```

`?file=hello.md` 에서 `file` 키의 값인 `hello.md`를 꺼냅니다.
`file` 파라미터가 없으면 `null`을 반환합니다.

```js
if (file) {
  this._applyView('post', { file }, false);
} else {
  this._applyView('list', {}, false);
}
```

누군가 URL을 직접 공유해서 `?file=...`로 접근했다면 → 포스트 화면으로 시작.
그렇지 않으면 → 목록 화면으로 시작.

---

#### 클릭 이벤트 위임

```js
document.addEventListener('click', (e) => {
```

`document` 전체에 클릭 이벤트를 하나만 등록합니다.
왜 각 카드마다 등록하지 않냐고요?

카드는 나중에 동적으로 생성됩니다. 카드가 만들어지기 전에 이벤트를 달 수 없습니다.
대신 document 전체에 달아두면, 나중에 생기는 카드를 클릭해도 잡힙니다.
이것을 **이벤트 위임(Event Delegation)**이라고 합니다.

```js
const card = e.target.closest('.post-card[data-file]');
```

`e.target`은 실제로 클릭된 요소입니다. 카드 안에 있는 텍스트를 클릭해도 됩니다.
`closest`는 "클릭된 요소 또는 그 부모 중에 `.post-card[data-file]`인 게 있냐?"를 찾습니다.
카드 안 어디를 클릭해도 카드 자체를 찾아냅니다.

```js
if (card) {
  e.preventDefault();
  this.goPost(card.dataset.file);
  return;
}
```

`e.preventDefault()`는 브라우저 기본 동작(링크 클릭 시 페이지 이동)을 막습니다.
`card.dataset.file`은 HTML의 `data-file="hello.md"` 속성 값을 가져옵니다.
`return`은 여기서 함수를 끝냅니다. 뒤의 backBtn 검사를 건너뜁니다.

```js
if (e.target.closest('#backBtn')) {
  e.preventDefault();
  this.goList();
}
```

`← 목록으로` 버튼 클릭 시 목록으로 돌아갑니다.

---

#### 브라우저 뒤로/앞으로 버튼

```js
window.addEventListener('popstate', (e) => {
  const state = e.state || { view: 'list' };
  this._applyView(state.view, state, false);
});
```

`popstate` 이벤트는 브라우저의 ←→ 버튼을 클릭할 때 발생합니다.
`e.state`는 `history.pushState`할 때 저장해둔 데이터입니다.
`|| { view: 'list' }`는 state가 없으면(히스토리 맨 처음) 목록으로 가라는 기본값입니다.

---

### `goPost` — 포스트로 이동

```js
goPost(file) {
  this._savedScrollY = window.scrollY;
```

`window.scrollY`는 현재 스크롤 위치(픽셀)입니다. 뒤로가기 때 복원하려고 저장합니다.

```js
  history.pushState({ view: 'post', file }, '', `?file=${encodeURIComponent(file)}`);
```

`history.pushState(상태, 제목, URL)`은 **페이지 이동 없이 URL만 바꿉니다.**
- 첫 번째 인자 `{ view: 'post', file }`: 나중에 뒤로가기 때 꺼낼 상태 데이터
- 두 번째 인자 `''`: 페이지 제목 (브라우저가 무시해서 빈 문자열)
- 세 번째 인자: 새 URL. `encodeURIComponent`는 한글이나 특수문자를 URL에 안전하게 변환

예: `file = 'PC/언어/c-basics.md'` → `?file=PC%2F%EC%96%B8%EC%96%B4%2Fc-basics.md`

```js
  this._applyView('post', { file }, true);
}
```

실제로 화면을 바꾸는 함수 호출. `true`는 맨 위로 스크롤하라는 뜻.

---

### `goList` — 목록으로 돌아가기

```js
goList() {
  history.pushState({ view: 'list' }, '', 'index.html');
  this._applyView('list', {}, true);
},
```

URL을 `index.html`로 바꾸고 목록 화면을 보여줍니다.

---

### `_applyView` — 실제 화면 전환

```js
_applyView(view, data, scroll) {
  const listEl = document.getElementById('listView');
  const postEl = document.getElementById('postView');
```

HTML에서 두 화면 요소를 가져옵니다.

```js
  if (view === 'post') {
    listEl?.classList.add('view-hidden');
    postEl?.classList.remove('view-hidden');
```

`?.`는 "해당 요소가 있으면 실행하고, null이면 무시해"라는 안전한 접근법입니다.
`view-hidden` 클래스를 달고 떼서 `display: none` 효과를 냅니다.

```js
    App.emit('router:post', { file: data.file });
```

App 이벤트를 발행합니다. app-index.js가 이걸 듣고 해당 마크다운 파일을 불러옵니다.

```js
    if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
```

`scroll`이 true이면 맨 위로 스크롤합니다. `behavior: 'instant'`는 애니메이션 없이 즉시 이동.

```js
  } else {
    postEl?.classList.add('view-hidden');
    listEl?.classList.remove('view-hidden');
    App.emit('router:list', {});

    if (scroll) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: this._savedScrollY, behavior: 'instant' });
      });
    }
  }
```

목록 화면으로 돌아올 때는 저장해뒀던 스크롤 위치로 복원합니다.

`requestAnimationFrame`을 쓰는 이유: 화면 전환(`classList` 변경)이 실제로 적용되기 전에 스크롤하면 위치가 틀릴 수 있습니다. 다음 프레임(화면 갱신 타이밍)에 실행하면 정확합니다.

---

## 전체 흐름 정리

```
카드 클릭
   │
   ▼
e.preventDefault()   ← 기본 페이지 이동 막기
   │
   ▼
history.pushState()  ← URL만 변경 (페이지 이동 없음)
   │
   ▼
_applyView('post')
   ├── listView 숨기기
   ├── postView 보이기
   └── App.emit('router:post') → app-index.js가 마크다운 로드

뒤로가기 버튼
   │
   ▼
popstate 이벤트
   │
   ▼
_applyView('list')
   ├── postView 숨기기
   ├── listView 보이기
   └── 저장된 스크롤 위치 복원
```

---

## 다음 파일

- **[03] storage.js** — localStorage를 안전하게 쓰는 방법
