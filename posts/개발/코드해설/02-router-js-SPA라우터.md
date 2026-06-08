---
title: "[코드 해설 02] router.js — 음악이 끊기지 않는 페이지 이동"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, SPA, 라우터]
excerpt: 페이지를 이동하지 않고 화면만 바꾸는 SPA 라우터. history.pushState와 이벤트 위임을 한 줄씩 파헤칩니다.
---

## 왜 이런 방식이 필요할까?

보통 블로그는 글을 클릭하면 새 페이지로 이동합니다.  
새 페이지가 로드되면 **모든 게 처음부터 다시 시작**돼요.

문제는 **음악**입니다. 뮤직 플레이어가 재생 중이었는데 페이지가 바뀌면 음악이 뚝 끊겨요.

이 블로그는 **페이지 이동 없이 콘텐츠만 교체**합니다. 음악이 끊기지 않아요.  
이 기술을 **SPA(Single Page Application)**라고 합니다.

---

## 동작 원리

```
1. 사용자가 카드 클릭
2. router.js가 클릭을 가로챔 (e.preventDefault)
3. URL만 바꿈 (실제 페이지 이동 없음)
4. 화면에서 목록 숨기고 게시글 내용 표시
```

브라우저 주소창은 바뀌지만, 실제로는 같은 페이지예요.

---

## 전체 구조

```javascript
const Router = {
  _savedScrollY: 0,  // 뒤로가기 시 목록 스크롤 위치 복원용

  init() { ... },      // 초기화
  goPost(file) { ... }, // 게시글 뷰로 이동
  goList() { ... },    // 목록 뷰로 이동
  _applyView() { ... } // 실제 뷰 전환 (내부 메서드)
};
```

---

## init() — 초기화

```javascript
init() {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  if (file) {
    this._applyView('post', { file }, false);
  } else {
    this._applyView('list', {}, false);
  }
```

**한 줄씩 설명:**

`new URLSearchParams(window.location.search)`  
→ URL의 `?` 뒤 부분을 파싱합니다.  
예: `?file=개발/hello.md` → `{file: '개발/hello.md'}`  
`window.location.search`는 현재 URL에서 `?file=...` 부분을 가져옵니다.

`params.get('file')`  
→ `file` 파라미터 값을 꺼냅니다. 없으면 `null`을 반환해요.

`if (file)` → 파라미터가 있으면 바로 게시글 뷰로 시작합니다.  
누군가 게시글 URL을 직접 복사해서 열었을 때를 처리하는 거예요.

---

## 클릭 이벤트 위임

```javascript
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
```

**"이벤트 위임"이란?**  
카드 하나하나에 클릭 이벤트를 달지 않고, 문서 전체(`document`)에 하나만 달아요.  
어디를 클릭해도 이 함수가 실행되고, 클릭한 게 카드인지 확인합니다.

`e.target.closest('.post-card[data-file]')`  
→ 클릭한 요소에서 시작해서 부모 방향으로 올라가며  
`post-card` 클래스이면서 `data-file` 속성이 있는 요소를 찾습니다.  
없으면 `null`을 반환해요.

`e.preventDefault()`  
→ 브라우저의 기본 동작(페이지 이동)을 막습니다.  
이게 없으면 `href`로 진짜 이동해버려요.

`card.dataset.file`  
→ HTML의 `data-file="개발/hello.md"` 속성 값을 읽습니다.  
`dataset`은 `data-` 로 시작하는 모든 속성을 담은 객체예요.

---

## goPost() — 게시글 뷰로 이동

```javascript
goPost(file) {
  this._savedScrollY = window.scrollY;
  history.pushState(
    { view: 'post', file },
    '',
    `?file=${encodeURIComponent(file)}`
  );
  this._applyView('post', { file }, true);
},
```

**한 줄씩 설명:**

`this._savedScrollY = window.scrollY`  
→ 현재 스크롤 위치를 저장합니다. 뒤로가기 했을 때 같은 위치로 돌아가려고요.

`history.pushState({ view: 'post', file }, '', '?file=...')`  
→ 페이지 이동 없이 URL만 바꿉니다.  
3개의 인자:
- 첫 번째: 저장할 상태 데이터 (뒤로가기 시 꺼내 씀)
- 두 번째: 페이지 제목 (보통 빈 문자열)
- 세 번째: 바꿀 URL

`encodeURIComponent(file)`  
→ 파일 경로에 한글이나 특수문자가 있으면 URL에서 오류가 납니다.  
`encodeURIComponent`가 안전한 형태로 변환해줘요.  
예: `개발/hello.md` → `%EA%B0%9C%EB%B0%9C%2Fhello.md`

---

## goList() — 목록 뷰로 이동

```javascript
goList() {
  history.pushState({ view: 'list' }, '', 'index.html');
  this._applyView('list', {}, true);
},
```

URL을 `index.html`로 되돌리고 목록 뷰를 표시합니다.

---

## _applyView() — 실제 화면 전환

```javascript
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
```

**한 줄씩 설명:**

`listEl?.classList.add('view-hidden')`  
→ `?` 는 **옵셔널 체이닝**입니다. `listEl`이 `null`이면 오류 대신 그냥 넘어가요.  
`view-hidden` CSS 클래스는 `display: none`을 적용해서 요소를 숨깁니다.

`App.emit('router:post', { file: data.file })`  
→ "게시글 뷰로 전환됐어요!"라고 소식을 보냅니다.  
`app-index.js`가 이 소식을 받아서 마크다운 파일을 불러와요.

`requestAnimationFrame(() => { ... })`  
→ 브라우저가 화면을 다시 그린 다음에 실행합니다.  
목록이 아직 숨겨지기 전에 스크롤하면 위치가 틀릴 수 있어서 한 프레임 기다리는 거예요.

---

## 뒤로가기 처리

```javascript
window.addEventListener('popstate', (e) => {
  const state = e.state || { view: 'list' };
  this._applyView(state.view, state, false);
});
```

브라우저의 뒤로가기 버튼을 누르면 `popstate` 이벤트가 발생합니다.  
`history.pushState`로 저장했던 상태(`{ view: 'post', file: '...' }`)가 `e.state`로 돌아와요.  
그 상태에 맞게 화면을 복원합니다.

---

## 정리

| 일반 블로그 | 이 블로그 |
|------------|----------|
| 글 클릭 → 새 페이지 로드 | 글 클릭 → URL만 변경 |
| 음악 플레이어 재시작 | 음악 계속 재생 |
| 스크롤 위치 초기화 | 뒤로가기 시 위치 복원 |
