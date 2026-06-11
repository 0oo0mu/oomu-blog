---
title: "[코드 해설 10] renderer.js — 포스트 카드를 화면에 그리기"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, DOM, innerHTML]
excerpt: 데이터 배열을 받아서 HTML 카드로 변환합니다. innerHTML 빌더, 검색어 하이라이트, 날짜 포맷팅을 한 줄씩 설명합니다.
---

## 이 파일이 하는 일

`filter.js`에서 필터링된 게시글 배열을 받아서  
화면에 카드 형태로 그립니다.

---

## 전체 흐름

```
filter.js → App.emit('posts:filtered', { posts, query })
renderer.js → 수신 → render(posts, query)
  → 각 포스트를 _cardHTML()로 변환
  → grid.innerHTML에 모두 합쳐서 한 번에 삽입
```

---

## 전체 코드

먼저 전체 코드를 눈으로 훑어보세요. 아래에서 한 부분씩 잘라 설명합니다.

```javascript
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

## render() — 목록 그리기

```javascript
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
```

**한 줄씩 설명:**

`document.getElementById('postsGrid')`  
→ `index.html`의 `<div id="postsGrid">` 를 찾습니다.  
카드들이 들어갈 컨테이너예요.

**빈 결과 처리:**  
검색어가 있으면 🔍와 "결과가 없어요", 없으면 📭와 "포스트가 없어요"를 표시합니다.

`posts.map(post => this._cardHTML(post, query)).join('')`  
→ 게시글 배열을 HTML 문자열 배열로 변환한 후 하나로 합칩니다.  
`.join('')`은 배열을 구분자 없이 연결해요.

`grid.innerHTML = ...`  
→ 기존 내용을 모두 지우고 새 내용으로 교체합니다.  
필터가 바뀔 때마다 전체를 다시 그리는 방식이에요.

---

## _cardHTML() — 카드 한 장 만들기

```javascript
_cardHTML(post, query) {
  const href    = `post.html?file=${encodeURIComponent(post.file)}`;
  const title   = query ? highlight(escapeHtml(post.title || ''), query)
                        : escapeHtml(post.title || '');
  const excerpt = query ? highlight(escapeHtml(post.excerpt || ''), query)
                        : escapeHtml(post.excerpt || '');

  return `
    <a class="post-card"
       href="${href}"
       data-file="${escapeHtml(post.file)}">
      ...
    </a>
  `;
},
```

**카드의 핵심은 `data-file`:**

```html
<a class="post-card" data-file="개발/코드해설/01-app-js.md">
```

`router.js`가 `.post-card[data-file]`을 클릭 감지합니다.  
이 속성이 있어야 클릭했을 때 SPA 방식으로 내용이 바뀌어요.

`href`는 JavaScript가 꺼져있을 때를 위한 폴백입니다.  
일반적으로는 router.js가 클릭을 가로채서 실제 이동은 일어나지 않아요.

---

## highlight() — 검색어 강조

```javascript
function highlight(text, query) {
  if (!query) return text;
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return text;
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return text.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}
```

검색어가 있으면 해당 단어를 `<mark>` 태그로 감쌉니다.  
`<mark>`는 HTML 기본 태그로 형광펜 스타일을 적용해요.

`w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`  
→ 정규식 특수문자를 이스케이프합니다.  
검색어에 `.`, `*`, `(` 같은 문자가 있어도 안전하게 처리해요.

`new RegExp(`(${pattern})`, 'gi')`  
→ 동적으로 정규식을 생성합니다.  
`g` = 전체 텍스트에서 모두 찾기, `i` = 대소문자 무시

`'<mark>$1</mark>'`  
→ `$1`은 매칭된 텍스트를 그대로 씁니다.  
원래 대소문자를 유지하면서 `<mark>` 태그로 감싸요.

---

## formatDate() — 날짜 형식 변환

```javascript
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}
```

`"2026-06-08"` → `"2026년 6월 8일"` 로 변환합니다.

`new Date('2026-06-08')` → 날짜 객체 생성  
`toLocaleDateString('ko-KR', {...})` → 한국어 형식으로 변환  
`year: 'numeric'` = 숫자 연도, `month: 'long'` = 긴 월 이름, `day: 'numeric'` = 숫자 일

---

## 왜 innerHTML을 쓰나?

DOM 요소를 하나씩 `createElement`로 만드는 방법도 있어요.  
하지만 카드가 20개라면 DOM 조작이 수십 번 일어납니다.

`innerHTML`에 한 번에 넣으면 브라우저가 한 번에 파싱하고 그려서 빠릅니다.  
단, 사용자 입력을 innerHTML에 넣을 때는 반드시 `escapeHtml()`로 정제해야 합니다.
