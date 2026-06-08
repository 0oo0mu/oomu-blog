---
title: "[코드 해설 08] filter.js — 카테고리·태그·검색어 통합 필터"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, 필터링, 이벤트]
excerpt: 카테고리, 태그, 검색어 세 가지가 동시에 작동하는 AND 필터. Array.filter와 이벤트 버스로 구현하는 방법을 설명합니다.
---

## 이 파일이 하는 일

블로그의 게시글 필터링을 전담합니다:
- 왼쪽 사이드바에서 카테고리 클릭
- 상단의 `#태그` 클릭
- 검색창에 검색어 입력
- 최신순/오래된순/제목순 정렬 버튼

이 중 **어느 것을 해도** filter.js가 세 조건을 동시에 적용해서 결과를 보여줍니다.

---

## 상태 관리

```javascript
state: {
  category: 'all',    // 선택된 카테고리 ('all' = 전체)
  tag:      'all',    // 선택된 태그
  query:    '',       // 검색어
  sort:     'newest', // 정렬
},
_allPosts: [],        // 전체 게시글 목록
```

상태를 한 곳에 모아두면 어떤 필터가 바뀌어도 같은 `_applyFilter()`를 호출하면 됩니다.

---

## 이벤트 수신 구조

```javascript
App.on('posts:loaded', ({ posts }) => {
  this._allPosts = posts;
  this._renderTagChips();
  this._bindSortBtns();
  this._applyFilter();
});

App.on('filter:category', ({ category }) => {
  this.state.category = category;
  this._applyFilter();
});

App.on('filter:search', ({ query }) => {
  this.state.query = query;
  this._applyFilter();
});
```

**패턴:** "상태 업데이트 → `_applyFilter()` 호출"  
어떤 필터가 바뀌든 항상 세 조건을 모두 다시 계산합니다.

---

## _applyFilter() — 핵심 필터 로직

```javascript
_applyFilter() {
  const { category, tag, query, sort } = this.state;

  let filtered = this._allPosts.filter(post => {
    // 카테고리 필터
    let catOk;
    if (category === 'all') {
      catOk = true;
    } else {
      const postCat = post.category || '';
      catOk = postCat === category || postCat.startsWith(category + '/');
    }

    // 태그 필터
    const tagOk = tag === 'all' || (post.tags || []).includes(tag);

    // 검색어 필터
    const searchOk = !query || this._matchSearch(post, query);

    return catOk && tagOk && searchOk; // AND 조건
  });
```

**한 줄씩 설명:**

`this._allPosts.filter(post => { ... })`  
→ 배열에서 조건에 맞는 것만 남깁니다.  
콜백 함수가 `true`를 반환하면 결과에 포함, `false`이면 제외해요.

**카테고리 계층 필터:**
```javascript
catOk = postCat === category || postCat.startsWith(category + '/');
```

단순히 같은지 비교하면 하위 폴더 게시글이 안 나와요.  
`개발`을 선택했을 때 `개발/코드해설` 폴더의 글도 보이려면  
`startsWith('개발/')` 조건을 추가해야 합니다.

| 선택 카테고리 | 게시글 카테고리 | 표시? |
|-------------|-------------|-----|
| `개발` | `개발` | ✅ (같음) |
| `개발` | `개발/코드해설` | ✅ (startsWith) |
| `개발` | `일상` | ❌ |

**AND 조건:**
```javascript
return catOk && tagOk && searchOk;
```

세 조건을 `&&`(AND)로 연결합니다.  
세 가지를 **모두** 만족해야 결과에 포함돼요.

---

## _matchSearch() — 검색 로직

```javascript
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
```

**검색 대상:** 제목 + 요약 + 카테고리 + 태그를 하나의 긴 문자열로 합칩니다.

`...(post.tags || [])` → 태그 배열을 펼쳐서 합칩니다.  
예: `...[' JavaScript', '입문']` → 개별 문자열로 펼쳐짐

`.toLowerCase()` → 대소문자 구분 없이 검색합니다.

`query.split(/\s+/).filter(Boolean)`  
→ 공백으로 나눕니다. 여러 공백도 처리해요.  
`filter(Boolean)` → 빈 문자열을 제거합니다.

`words.every(word => searchText.includes(word))`  
→ **모든** 단어가 포함되어야 합니다 (AND 검색).  
"javascript 입문" → 'javascript'도 있고 '입문'도 있어야 매칭돼요.

---

## 정렬

```javascript
if (sort === 'oldest') {
  filtered = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
} else if (sort === 'title') {
  filtered = [...filtered].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '', 'ko')
  );
}
```

`[...filtered]` → 원본 배열을 복사합니다. `sort()`는 원본을 수정하기 때문에 방어적으로 복사해요.

`new Date(a.date) - new Date(b.date)` → 날짜를 숫자로 변환해서 빼기 (오래된 것이 먼저)

`localeCompare(b, 'ko')` → 한국어 문자열 비교.  
일반 `>`, `<` 비교는 한글 가나다 순서를 제대로 처리하지 못해요.

---

## escapeHtml() — XSS 방지

```javascript
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

검색어를 `innerHTML`에 넣을 때 사용합니다.  
사용자가 `<script>alert('해킹')</script>` 같은 검색어를 입력해도 그냥 텍스트로 표시돼요.  
이것을 **XSS(Cross-Site Scripting) 방지**라고 합니다.
