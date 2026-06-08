---
title: "[코드 해설 10] renderer.js — 포스트 카드를 화면에 그리기"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, DOM, 렌더링]
excerpt: filter.js가 걸러낸 포스트 목록을 받아서 HTML 카드로 만들어 화면에 뿌리는 렌더러. 검색어 하이라이트와 XSS 방지까지 설명합니다.
---

# renderer.js — 포스트 카드를 화면에 그리기

## 이 파일이 하는 일

filter.js가 "이 포스트들을 보여줘"라고 이벤트를 발행하면, renderer.js가 그 목록을 받아서 HTML 카드로 변환해 화면에 그립니다.

```
filter.js
   │
   └─ App.emit('posts:filtered', { posts, query })
                    │
                    ▼
             renderer.js
                    │
                    └─ postsGrid에 카드 HTML 삽입
```

---

## 전체 코드

```js
import App from '../core/app.js';

const Renderer = {
  init() {
    App.on('posts:filtered', ({ posts, query = '' }) => {
      this.render(posts, query);
    });
  },

  render(posts, query = '') {
    const grid = document.getElementById('postsGrid');
    if (!grid) return;

    if (posts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${query ? '🔍' : '📭'}</div>
          <p>${query
            ? `<strong>"${escapeHtml(query)}"</strong>에 대한 결과가 없어요.`
            : '해당하는 포스트가 없어요.'
          }</p>
        </div>`;
      return;
    }

    grid.innerHTML = posts.map(post => this._cardHTML(post, query)).join('');
  },

  _cardHTML(post, query) {
    const href    = `post.html?file=${encodeURIComponent(post.file)}`;
    const title   = query ? highlight(escapeHtml(post.title   || ''), query) : escapeHtml(post.title   || '');
    const excerpt = query ? highlight(escapeHtml(post.excerpt || ''), query) : escapeHtml(post.excerpt || '');

    const categoryBadge = post.category
      ? `<span class="post-category">${escapeHtml(post.category)}</span>`
      : '';

    const tagsHTML = (post.tags || [])
      .map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`)
      .join('');

    return `
      <a class="post-card"
         href="${href}"
         data-file="${escapeHtml(post.file)}">
        ${categoryBadge}
        <h2 class="post-card-title">${title}</h2>
        <p class="post-card-excerpt">${excerpt}</p>
        <div class="post-card-meta">
          <span class="post-date">${formatDate(post.date)}</span>
          <div class="post-tags">${tagsHTML}</div>
        </div>
      </a>
    `;
  },
};

function highlight(text, query) {
  if (!query) return text;
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return text;
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return text.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default Renderer;
```

---

## 한 줄씩 설명

### `init` — 이벤트 구독

```js
init() {
  App.on('posts:filtered', ({ posts, query = '' }) => {
    this.render(posts, query);
  });
},
```

`query = ''`는 이벤트 데이터에 query가 없을 경우의 기본값입니다.
filter.js가 `posts:filtered` 이벤트를 발행할 때마다 `render()`를 호출합니다.

---

### `render` — 카드 목록 렌더링

#### 빈 결과 처리

```js
if (posts.length === 0) {
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${query ? '🔍' : '📭'}</div>
      <p>${query
        ? `<strong>"${escapeHtml(query)}"</strong>에 대한 결과가 없어요.`
        : '해당하는 포스트가 없어요.'
      }</p>
    </div>`;
  return;
}
```

포스트가 없을 때 빈 상태 메시지를 표시합니다.
검색어가 있으면 🔍와 "검색 결과 없음", 검색어가 없으면 📭와 "포스트 없음".

#### 카드 생성

```js
grid.innerHTML = posts.map(post => this._cardHTML(post, query)).join('');
```

`posts.map(...)`으로 각 포스트를 카드 HTML 문자열로 변환합니다.
`.join('')`으로 배열을 하나의 문자열로 합칩니다.
`grid.innerHTML = ...`으로 한 번에 DOM에 삽입합니다.

---

### `_cardHTML` — 카드 HTML 생성

#### href와 data-file

```js
const href = `post.html?file=${encodeURIComponent(post.file)}`;
```

`encodeURIComponent`는 URL에 안전하지 않은 문자를 변환합니다.
예: `'PC/언어/c-basics.md'` → `'PC%2F%EC%96%B8%EC%96%B4%2Fc-basics.md'`

이 href는 **JavaScript가 꺼진 환경의 폴백**입니다.
실제로는 router.js가 클릭을 가로채서 SPA로 처리합니다.

```html
<a class="post-card"
   href="post.html?file=..."
   data-file="PC/언어/c-basics.md">
```

`data-file`에는 원본 경로를 저장합니다. router.js가 여기서 파일 경로를 읽습니다.

#### 검색어 하이라이트

```js
const title = query
  ? highlight(escapeHtml(post.title || ''), query)
  : escapeHtml(post.title || '');
```

검색어가 있으면 → 먼저 escapeHtml(XSS 방지)하고, 그 다음 highlight(검색어 강조).
없으면 → escapeHtml만.

순서가 중요합니다. `highlight` 먼저 하면 `<mark>` 태그가 이스케이프됩니다.
`escapeHtml` 먼저 해야 `<mark>` 태그가 살아남습니다.

#### 태그 목록

```js
const tagsHTML = (post.tags || [])
  .map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`)
  .join('');
```

각 태그를 `<span>` 태그로 감싸서 이어붙입니다.
`post.tags || []`: tags가 없으면 빈 배열로 처리.

---

### `highlight` — 검색어 강조

```js
function highlight(text, query) {
  if (!query) return text;
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return text;

  const pattern = words
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  return text.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}
```

**`w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`**
사용자가 입력한 검색어에 정규표현식 특수문자가 있으면 오류가 납니다.
예: `'C++'`을 검색하면 `+`가 정규표현식 연산자로 해석됩니다.
`\\$&`에서 `$&`는 매칭된 문자 자체를 의미합니다. 앞에 `\\`를 붙여서 이스케이프합니다.
`'C++'` → `'C\\+\\+'` → 정규표현식에서 문자 그대로의 `++` 취급

**`words.join('|')`**
여러 단어를 `|`로 연결합니다. 정규표현식의 `|`는 "또는(OR)"입니다.
`'자바|스크립트'` → "자바" 또는 "스크립트"에 매칭

**`new RegExp(`(${pattern})`, 'gi')`**
- `g` 플래그: 전체에서 모두 찾기 (global)
- `i` 플래그: 대소문자 구분 없이 (case-insensitive)
- `(${pattern})`: 괄호로 그룹 지어서 `$1`로 참조 가능하게

**`'<mark>$1</mark>'`**
매칭된 텍스트(`$1`)를 `<mark>` 태그로 감쌉니다. 브라우저가 노란 배경으로 표시합니다.

---

### `formatDate` — 날짜 포맷

```js
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}
```

`'2026-06-02'` → `'2026년 6월 2일'`

`new Date('2026-06-02')`: 날짜 문자열을 Date 객체로 변환.
`toLocaleDateString('ko-KR', { ... })`: 한국어 형식으로 포맷.

---

## 다음 파일

- **[11] sidebar.js** — 카테고리 트리 만들기
