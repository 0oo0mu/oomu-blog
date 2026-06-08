---
title: "[코드 해설 08] filter.js — 카테고리·태그·검색어 통합 필터"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, 필터링, 이벤트]
excerpt: 세 가지 필터를 AND 조건으로 합치는 방법. filter(), every(), 계층 카테고리 매칭을 한 줄씩 파헤칩니다.
---

# filter.js — 카테고리·태그·검색어 통합 필터

## 이 파일이 하는 일

블로그에는 세 가지 필터가 있습니다.

1. **카테고리** — 왼쪽 사이드바에서 선택 (예: "PC/언어")
2. **태그** — 상단 칩 버튼으로 선택 (예: "#JavaScript")
3. **검색어** — 검색창에 입력

이 셋을 **AND 조건**으로 합쳐서 결과를 냅니다.
카테고리가 "PC", 태그가 "#C", 검색어가 "포인터"이면 → 셋 다 만족하는 글만 표시.

---

## 전체 코드

```js
import App from '../core/app.js';

const Filter = {
  state: {
    category: 'all',
    tag:      'all',
    query:    '',
  },

  _allPosts: [],

  init() {
    App.on('posts:loaded', ({ posts }) => {
      this._allPosts = posts;
      this._renderTagChips();
      this._applyFilter();
    });

    App.on('filter:category', ({ category }) => {
      this.state.category = category;
      this._applyFilter();
    });

    App.on('filter:search', ({ query }) => {
      this.state.query = query;
      this._updateResultInfo();
      this._applyFilter();
    });
  },

  _renderTagChips() {
    const container = document.getElementById('tagChips');
    if (!container) return;

    const tags = ['all', ...new Set(this._allPosts.flatMap(p => p.tags || []))];

    container.innerHTML = tags.map(tag => `
      <button class="chip ${tag === this.state.tag ? 'active' : ''}"
              data-value="${tag}">
        ${tag === 'all' ? '전체' : '#' + tag}
      </button>
    `).join('');

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      this.state.tag = btn.dataset.value;
      this._applyFilter();
    });
  },

  _updateResultInfo(count) {
    const el = document.getElementById('searchResultInfo');
    if (!el) return;
    const { query } = this.state;
    if (!query) { el.innerHTML = ''; return; }
    if (count === undefined) {
      el.innerHTML = `<strong>"${escapeHtml(query)}"</strong> 검색 중...`;
    } else if (count === 0) {
      el.innerHTML = `<strong>"${escapeHtml(query)}"</strong> 검색 결과 없음`;
    } else {
      el.innerHTML = `<strong>"${escapeHtml(query)}"</strong> 검색 결과 <strong>${count}개</strong>`;
    }
  },

  _applyFilter() {
    const { category, tag, query } = this.state;

    const filtered = this._allPosts.filter(post => {
      let catOk;
      if (category === 'all') {
        catOk = true;
      } else {
        const postCat = post.category || '';
        catOk = postCat === category || postCat.startsWith(category + '/');
      }

      const tagOk = tag === 'all' || (post.tags || []).includes(tag);
      const searchOk = !query || this._matchSearch(post, query);

      return catOk && tagOk && searchOk;
    });

    this._updateResultInfo(filtered.length);
    App.emit('posts:filtered', { posts: filtered, query });
  },

  _matchSearch(post, query) {
    const searchText = [
      post.title    || '',
      post.excerpt  || '',
      post.category || '',
      ...(post.tags || []),
    ].join(' ').toLowerCase();

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return words.every(word => searchText.includes(word));
  },
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default Filter;
```

---

## 한 줄씩 설명

### 초기 상태

```js
state: {
  category: 'all',
  tag:      'all',
  query:    '',
},
```

세 필터의 현재 상태를 저장합니다. `'all'`은 "전체 보기", `''`는 "검색어 없음"입니다.
이벤트가 올 때마다 이 상태를 업데이트하고 `_applyFilter()`를 다시 실행합니다.

---

### `init` — 이벤트 구독

```js
App.on('posts:loaded', ({ posts }) => {
  this._allPosts = posts;
  this._renderTagChips();
  this._applyFilter();
});
```

`({ posts })`는 구조분해입니다. `App.emit('posts:loaded', { posts: [...] })` 에서 `posts`만 꺼냅니다.
전체 포스트 목록을 받아 저장하고, 태그 칩을 만들고, 첫 번째 필터링을 실행합니다.

---

### `_renderTagChips` — 태그 버튼 생성

```js
const tags = ['all', ...new Set(this._allPosts.flatMap(p => p.tags || []))];
```

이 한 줄이 좀 복잡합니다. 단계별로 풀어보겠습니다.

**`this._allPosts.flatMap(p => p.tags || [])`**
`flatMap`은 map + 평탄화입니다.
- 각 포스트의 tags 배열을 꺼냄: `[['JS', 'CSS'], ['JS', 'React'], ['CSS']]`
- 그것을 하나의 배열로 펼침: `['JS', 'CSS', 'JS', 'React', 'CSS']`
- `p.tags || []`: tags가 없는 포스트는 빈 배열로 처리

**`new Set(...)`**
Set은 중복을 자동으로 제거하는 자료구조입니다.
`new Set(['JS', 'CSS', 'JS', 'React', 'CSS'])` → `{'JS', 'CSS', 'React'}`

**`['all', ...]`**
맨 앞에 'all'을 추가합니다.
`...`(스프레드)는 Set을 배열로 펼칩니다.
결과: `['all', 'JS', 'CSS', 'React']`

---

### `_applyFilter` — 필터 실행

```js
const filtered = this._allPosts.filter(post => {
```

`filter`는 배열에서 조건을 만족하는 항목만 골라냅니다.
화살표 함수가 `true`를 반환하면 남기고, `false`이면 제외합니다.

#### 카테고리 필터

```js
let catOk;
if (category === 'all') {
  catOk = true;
} else {
  const postCat = post.category || '';
  catOk = postCat === category || postCat.startsWith(category + '/');
}
```

`category = 'PC'`를 선택했을 때:
- `post.category = 'PC'` → `catOk = true` (정확히 일치)
- `post.category = 'PC/언어'` → `catOk = true` ('PC/'로 시작)
- `post.category = 'PC/언어/C'` → `catOk = true` ('PC/'로 시작)
- `post.category = '개발'` → `catOk = false` (무관)

`startsWith('PC/')`에서 `'/'`를 붙이는 이유: 'PC'와 'PC게임'을 구분하기 위해서.

#### 태그 필터

```js
const tagOk = tag === 'all' || (post.tags || []).includes(tag);
```

`includes`는 배열 안에 해당 값이 있으면 `true`.
`post.tags || []`: tags가 null/undefined이면 빈 배열로 대체.

#### 검색 필터

```js
const searchOk = !query || this._matchSearch(post, query);
```

`!query`는 검색어가 빈 문자열이면 `true` (검색 안 하는 상태).
검색어가 있으면 `_matchSearch`로 확인합니다.

#### AND 조건 합치기

```js
return catOk && tagOk && searchOk;
```

셋이 **모두** true일 때만 이 포스트를 남깁니다.
하나라도 false면 제외합니다.

---

### `_matchSearch` — 검색 매칭

```js
_matchSearch(post, query) {
  const searchText = [
    post.title    || '',
    post.excerpt  || '',
    post.category || '',
    ...(post.tags || []),
  ].join(' ').toLowerCase();
```

검색 대상 텍스트를 만듭니다.
제목, 요약, 카테고리, 태그를 공백으로 이어붙이고 소문자로 변환합니다.
`toLowerCase()`: 대소문자 구분 없이 검색하기 위해.

```js
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every(word => searchText.includes(word));
}
```

**`query.split(/\s+/)`**
`/\s+/`는 정규표현식으로 "하나 이상의 공백"입니다.
`'자바스크립트 입문'.split(/\s+/)` → `['자바스크립트', '입문']`

**`.filter(Boolean)`**
`Boolean`은 값이 truthy이면 `true`, falsy이면 `false`를 반환합니다.
빈 문자열 `''`은 falsy이므로 제거됩니다. 앞뒤 공백만 입력해도 안전합니다.

**`words.every(word => searchText.includes(word))`**
`every`는 배열의 **모든** 항목이 조건을 만족할 때만 `true`입니다.
→ "자바스크립트"도 있고 "입문"도 있어야 매칭 (AND 검색).

---

### `escapeHtml` — XSS 방지

```js
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

검색어를 innerHTML에 직접 넣으면 보안 취약점이 생깁니다.
예: 검색어가 `<script>alert('해킹')</script>` 이면 스크립트가 실행됩니다.

특수문자를 HTML 엔티티로 변환하면 브라우저가 텍스트로만 표시하고 실행하지 않습니다.
- `<` → `&lt;` (less than)
- `>` → `&gt;` (greater than)
- `/g` 플래그: 문자열 전체에서 **모두(global)** 교체

---

## 다음 파일

- **[09] search.js** — 검색창 입력 처리와 디바운스
