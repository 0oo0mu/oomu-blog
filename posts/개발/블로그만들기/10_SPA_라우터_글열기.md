---
title: [블로그 만들기] 10. SPA 라우터 — 클릭하면 페이지 이동 없이 글 열기
date: 2026-07-14
category: 개발/블로그만들기
tags: [블로그만들기, SPA, router, history, 포스트뷰]
excerpt: 카드를 클릭하면 페이지를 새로 로드하지 않고 콘텐츠만 바꿔 글을 여는 SPA 라우터(router.js)를 만듭니다. history API, 클릭 이벤트 위임, 뒤로가기 처리와 포스트 본문 렌더링까지 실제 코드로 완성합니다.
---

# SPA 라우터 — 페이지 이동 없이 글 열기

지금은 카드를 누르면 `post.html`로 **페이지가 통째로 새로 열립니다.** 그런데 그러면 나중에 만들 뮤직 플레이어가 페이지 이동마다 **끊겨요.** 그래서 이 블로그는 **SPA** 방식을 씁니다. 이번 편에서 그 핵심인 `router.js`를 만듭니다.

## SPA가 뭔가요

**SPA**(Single Page Application, 단일 페이지 앱)는 이름 그대로 **페이지는 하나**인데, 자바스크립트로 **화면 내용만 바꿔치기**해서 여러 페이지처럼 보이게 하는 방식입니다.

- 일반 방식: 목록 클릭 → `post.html`을 서버에서 새로 받아옴 → 화면 전체가 깜빡이며 새로 그려짐 (음악·상태 다 초기화)
- SPA 방식: 목록 클릭 → **페이지는 그대로 두고** 목록 부분만 숨기고 글 부분만 보여줌 → 깜빡임 없음, 헤더·음악 그대로 유지

우리 계획: 한 `index.html` 안에 **목록 뷰(`#listView`)**와 **포스트 뷰(`#postView`)**를 둘 다 넣어두고, 상황에 따라 하나는 숨기고 하나는 보여줍니다.

## 두 가지 핵심 기술

### 1) history API — 주소만 바꾸기

페이지를 새로 안 열면서 **주소창만** 바꾸고 싶습니다. 그래야 새로고침하거나 링크를 공유해도 그 글이 열리니까요. 브라우저의 `history.pushState`가 이걸 해줍니다.

```javascript
history.pushState({ view: 'post', file }, '', `?file=${encodeURIComponent(file)}`);
```

이 한 줄은 **페이지 이동 없이** 주소창을 `?file=글경로`로 바꾸고, 뒤로가기용 상태(`{ view, file }`)를 기록에 남깁니다. `encodeURIComponent`는 파일 경로에 한글이나 특수문자(`+` 등)가 있어도 주소에서 안전하게 만들어줍니다.

### 2) 이벤트 위임 — 카드가 나중에 생겨도 클릭 잡기

카드는 자바스크립트가 나중에 그립니다. 아직 없는 카드에 미리 클릭 이벤트를 달 순 없죠. 그래서 **문서 전체에 딱 하나** 클릭 감시를 달고, "클릭된 게 카드면 처리"하는 방식을 씁니다. 이걸 **이벤트 위임**이라고 해요.

```javascript
document.addEventListener('click', (e) => {
  const card = e.target.closest('.post-card[data-file]');
  if (card) { e.preventDefault(); this.goPost(card.dataset.file); }
});
```

`e.target`은 실제로 클릭된 요소, `.closest('.post-card[data-file]')`는 "클릭 지점에서 위로 올라가며 `post-card` 카드를 찾기"입니다. 카드가 언제 새로 그려지든 상관없이 클릭이 잡힙니다.

## 실제 파일 — js/core/router.js

`js/core/router.js`를 만드세요. 이 블로그 실제 코드 그대로입니다.

```javascript
import App from './app.js';

const Router = {
  _savedScrollY: 0, // 뒤로가기 시 목록 스크롤 위치 복원용

  init() {
    // 초기 URL에 ?file= 이 있으면 포스트 뷰로 시작 (링크 공유/새로고침 대응)
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    if (file) this._applyView('post', { file }, false);
    else      this._applyView('list', {}, false);

    // 클릭 이벤트 위임 (문서 전체에 한 번만)
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

    // 브라우저 뒤로/앞으로 버튼
    window.addEventListener('popstate', (e) => {
      const state = e.state || { view: 'list' };
      this._applyView(state.view, state, false);
    });
  },

  goPost(file) {
    this._savedScrollY = window.scrollY; // 목록 스크롤 저장
    history.pushState({ view: 'post', file }, '', `?file=${encodeURIComponent(file)}`);
    this._applyView('post', { file }, true);
  },

  goList() {
    history.pushState({ view: 'list' }, '', 'index.html');
    this._applyView('list', {}, true);
  },

  // 뷰 전환 (내부): #listView / #postView 표시·숨김
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

**해설**

- **`init()`** — 세 가지를 준비합니다.
  1. 초기 URL 확인: 누가 `index.html?file=글경로`로 바로 들어오면(링크 공유·새로고침) 곧장 포스트 뷰로 시작. 아니면 목록 뷰.
  2. 클릭 위임: 카드 클릭 → `goPost`, "← 목록으로" 버튼(`#backBtn`) 클릭 → `goList`.
  3. `popstate`: 브라우저의 뒤로/앞으로 버튼을 누르면 발생하는 사건. 저장된 상태(`e.state`)를 보고 해당 뷰로 전환합니다.
- **`goPost(file)`** — 현재 목록 스크롤 위치를 저장하고, 주소를 `?file=...`로 바꾼 뒤(`pushState`), 포스트 뷰로 전환합니다.
- **`goList()`** — 주소를 `index.html`로 되돌리고 목록 뷰로.
- **`_applyView(view, ...)`** — 실제 화면 전환의 핵심. `#listView`와 `#postView` 중 하나에 **`view-hidden` 클래스를 붙였다 뗐다** 하며 보이기/숨기기를 합니다. 그리고 **이벤트를 방송**합니다. 포스트 뷰로 갈 땐 `router:post`(글 파일 정보와 함께) — 이걸 `app-index.js`가 듣고 실제 글을 불러와 그립니다. 목록으로 돌아갈 땐 스크롤을 원래 보던 위치로 복원해요(`requestAnimationFrame`은 "화면 그려진 직후에 실행"하라는 뜻).
- `?.`(옵셔널 체이닝) — `listEl?.classList`는 "listEl이 없으면(null) 그냥 넘어가"라는 안전 표시입니다.

## HTML — 두 뷰 넣기

`index.html`의 `<body>`를 목록 뷰와 포스트 뷰 둘 다 담도록 바꿉니다.

```html
<body>
  <div class="page-container">
    <!-- 목록 뷰 -->
    <div id="listView">
      <h1>내 블로그</h1>
      <div class="posts-grid" id="postsGrid"></div>
    </div>

    <!-- 포스트 뷰 (처음엔 숨김) -->
    <div id="postView" class="view-hidden">
      <a href="index.html" id="backBtn">← 목록으로</a>
      <div id="postHeader"></div>
      <div class="post-body" id="postBody"></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/marked@9/marked.min.js"></script>
  <script type="module" src="js/app-index.js"></script>
</body>
```

그리고 뷰를 숨기는 CSS 한 줄이 필요합니다. `index.html`의 `<head>`에 작은 `<style>`을 넣거나 CSS 파일에 추가하세요.

```css
.view-hidden { display: none !important; }
```

`display: none`은 "화면에서 완전히 숨김", `!important`는 "다른 규칙보다 이걸 우선"입니다.

## 포스트 뷰 렌더링 — app-index.js에 추가

라우터가 `router:post`를 방송하면, 실제로 글을 불러와 그리는 부분이 필요합니다. 09편의 `app-index.js`에 아래를 추가합니다.

```javascript
import App         from './core/app.js';
import Router      from './core/router.js';
import PostsLoader from './modules/posts-loader.js';
import Renderer    from './modules/renderer.js';
import Markdown    from './modules/markdown.js';

App.register('renderer', Renderer);

// 임시 연결 (11편에서 필터로 교체)
App.on('posts:loaded', ({ posts }) => App.emit('posts:filtered', { posts }));

// 날짜 포맷 (렌더러의 것과 같은 함수)
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR',
    { year: 'numeric', month: 'long', day: 'numeric' });
}

// 포스트 뷰: router:post 를 받아 글 파일을 불러와 렌더
App.on('router:post', async ({ file }) => {
  const headerEl = document.getElementById('postHeader');
  const bodyEl   = document.getElementById('postBody');
  bodyEl.innerHTML = '<p>불러오는 중...</p>';

  try {
    const res = await fetch(`posts/${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { meta, content } = Markdown.parseFrontMatter(await res.text());

    // 헤더(제목/카테고리/날짜)
    headerEl.innerHTML = `
      ${meta.category ? `<span class="post-category">${meta.category}</span>` : ''}
      <h1>${meta.title || '제목 없음'}</h1>
      <div class="post-card-meta">
        <span class="post-date">${formatDate(meta.date)}</span>
      </div>`;

    // 본문 (마크다운 → HTML)
    bodyEl.innerHTML = Markdown.parse(content);

  } catch (err) {
    bodyEl.innerHTML = `<p>포스트를 불러올 수 없습니다: ${err.message}</p>`;
  }
});

// ★ 라우터 초기화는 App.on(...) 등록들이 끝난 "뒤에" 해야 합니다!
Router.init();

// 글 목록 로드
PostsLoader.load();
```

**여기서 제일 중요한 것** — 맨 아래 `Router.init()`이 **`App.on('router:post', ...)` 등록보다 뒤에** 있어야 합니다. `Router.init()`은 초기 URL에 `?file=`이 있으면 곧바로 `router:post`를 방송하는데, 만약 구독(`App.on`)이 아직 안 됐으면 그 방송을 아무도 못 들어서 **새로고침(F5) 시 글이 안 뜨는 버그**가 납니다. (실제로 이 블로그를 만들 때 겪었던 버그예요. "구독 먼저, 발행 나중" 규칙의 실전 사례입니다.)

## 자주 나는 실수

- **F5(새로고침)하면 글이 안 뜸** → `Router.init()`을 `App.on('router:post', ...)`보다 먼저 호출한 경우. 순서를 바꾸세요.
- **카드 눌러도 반응 없음** → 카드에 `data-file` 속성이 있는지(renderer가 넣음), `router.js`의 클릭 위임이 켜졌는지 확인.
- **글 열리는데 목록으로 안 돌아옴** → "← 목록으로" 버튼 `id="backBtn"` 확인.
- **뒤로가기 하면 이상함** → `popstate` 처리와 `pushState`의 state 객체를 확인.

## 정리

- **SPA**: 한 페이지 안에서 목록 뷰/포스트 뷰를 숨기고 보이며 전환 → 깜빡임·끊김 없음.
- **history API**(`pushState`, `popstate`)로 페이지 이동 없이 주소만 바꾸고 뒤로가기 지원.
- **이벤트 위임**으로 나중에 생기는 카드의 클릭도 잡는다.
- `router.js`는 뷰를 전환하며 `router:post` / `router:list`를 방송하고, `app-index.js`가 그걸 받아 글을 렌더한다.
- **철칙**: `Router.init()`은 이벤트 구독을 모두 등록한 뒤에.

다음 편(11)에서는 임시 연결을 걷어내고, **카테고리·태그·검색·정렬로 글을 걸러내는 필터(filter.js)**를 만들어 진짜 블로그다운 탐색 기능을 붙입니다.
