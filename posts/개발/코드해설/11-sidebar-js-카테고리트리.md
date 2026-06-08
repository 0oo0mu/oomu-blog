---
title: "[코드 해설 11] sidebar.js — 카테고리 폴더 트리 만들기"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, 트리구조, 재귀]
excerpt: 'PC/언어/C' 같은 경로를 파싱해서 폴더 트리로 만드는 방법. 재귀 함수와 트리 자료구조를 처음 보는 사람도 이해할 수 있게 설명합니다.
---

# sidebar.js — 카테고리 폴더 트리 만들기

## 이 파일이 하는 일

왼쪽 사이드바의 폴더 트리를 만들고, 클릭하면 해당 카테고리로 필터링합니다.

포스트의 `category` 필드에 `"PC/언어/C"` 처럼 경로가 저장됩니다.
이 경로들을 파싱해서 폴더 구조로 만드는 것이 핵심입니다.

```
posts.json의 카테고리 값들:
  "개발"
  "개발"
  "PC/언어"
  "PC/언어/C"

→ 사이드바 트리:
  🗂 전체 (4)
  📁 개발 (2)
  📁 PC (2)
    📁 언어 (2)
      📄 C (1)
```

---

## 트리 자료구조 이해

코드를 보기 전에 트리가 어떤 구조인지 이해해야 합니다.

```js
// "PC/언어/C" 포스트가 있을 때 만들어지는 트리 구조
{
  _posts: 전체수,
  _children: {
    "PC": {
      _posts: 0,        // "PC" 카테고리 직접 포스트 없음
      _total: 2,        // 하위 포함 2개
      _children: {
        "언어": {
          _posts: 1,    // "PC/언어" 직접 포스트 1개
          _total: 2,    // 하위 포함 2개
          _children: {
            "C": {
              _posts: 1, // "PC/언어/C" 직접 포스트 1개
              _total: 1,
              _children: {}
            }
          }
        }
      }
    }
  }
}
```

이 트리 구조를 코드로 만들고, DOM으로 그립니다.

---

## 핵심 코드만 설명

### 트리 구조 생성

```js
const root = { _posts: posts.length, _children: {} };

posts.forEach(post => {
  if (!post.category) return;

  // "PC/언어/C" → ['PC', '언어', 'C']
  const parts = post.category.split('/').filter(Boolean);
  let node = root;

  parts.forEach((part, depth) => {
    // 이 이름의 자식 노드가 없으면 새로 만든다
    if (!node._children[part]) {
      node._children[part] = { _posts: 0, _children: {} };
    }
    // 마지막 파트에만 포스트 수 +1
    if (depth === parts.length - 1) {
      node._children[part]._posts++;
    }
    // 한 단계 아래로 내려간다
    node = node._children[part];
  });
});
```

**`post.category.split('/')`**
`'PC/언어/C'.split('/')` → `['PC', '언어', 'C']`
문자열을 `/`를 기준으로 쪼갭니다.

**`let node = root`**
현재 위치를 추적하는 포인터입니다. 루트에서 시작합니다.

**`parts.forEach((part, depth) => { ... })`**
`['PC', '언어', 'C']`를 하나씩 처리합니다.
- `part = 'PC'`, `depth = 0`: root 아래에 PC 노드 확인/생성, node를 PC로 이동
- `part = '언어'`, `depth = 1`: PC 아래에 언어 노드 확인/생성, node를 언어로 이동
- `part = 'C'`, `depth = 2`: 마지막! 언어 아래에 C 노드 확인/생성, `_posts++`

**`depth === parts.length - 1`**
마지막 파트인지 확인합니다. 길이가 3이면 마지막 인덱스는 2.
마지막 파트에서만 `_posts++` 해야 합니다. 중간 폴더(`PC`, `언어`)에는 +1하지 않습니다.

---

### 하위 합산 (재귀 함수)

```js
function calcTotal(node) {
  const childrenTotal = Object.values(node._children).reduce((sum, child) => {
    return sum + calcTotal(child);  // 재귀!
  }, 0);
  node._total = node._posts + childrenTotal;
  return node._total;
}
```

**재귀(Recursion):** 함수가 자기 자신을 호출하는 것입니다.

이 함수는 "내 자식들의 total을 다 더해줘"를 자식에게도 똑같이 시킵니다.
가장 깊은 노드(자식이 없는)부터 계산해서 위로 올라옵니다.

**`Object.values(node._children)`**
`_children` 객체의 값들만 배열로 꺼냅니다.
예: `{ 'PC': {...}, '개발': {...} }` → `[{...}, {...}]`

**`reduce((sum, child) => { ... }, 0)`**
`reduce`는 배열을 하나의 값으로 줄입니다.
`sum`은 누적값(초기값 0), `child`는 현재 처리 중인 자식 노드.
각 자식의 `calcTotal` 결과를 더해갑니다.

---

### 노드 렌더링 (재귀)

```js
_renderNode(name, node, parentPath) {
  const fullPath   = parentPath ? `${parentPath}/${name}` : name;
  const hasChildren = Object.keys(node._children).length > 0;

  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.innerHTML = `
    ${hasChildren ? `<span class="tree-arrow">▶</span>` : `<span class="tree-arrow" style="opacity:0">▶</span>`}
    <span class="tree-name">${hasChildren ? '📁' : '📄'} ${name}</span>
    <span class="tree-count">${node._total}</span>
  `;

  btn.addEventListener('click', () => {
    if (hasChildren) li.classList.toggle('open');
    this._select(fullPath);
  });

  li.appendChild(btn);

  if (hasChildren) {
    const ul = document.createElement('ul');
    Object.entries(node._children).forEach(([childName, childNode]) => {
      ul.appendChild(this._renderNode(childName, childNode, fullPath));  // 재귀!
    });
    li.appendChild(ul);
  }

  return li;
},
```

**`parentPath ? \`${parentPath}/${name}\` : name`**
부모 경로가 있으면 합쳐서 전체 경로 생성.
`parentPath = 'PC'`, `name = '언어'` → `fullPath = 'PC/언어'`

**`document.createElement('li')`**
JavaScript로 HTML 요소를 만드는 방법입니다.
`innerHTML = '...'`은 문자열로 넣는 방법, `createElement`는 객체로 만드는 방법입니다.

**재귀 렌더링**
자식이 있으면 `<ul>`을 만들고, 각 자식에 대해 `_renderNode`를 다시 호출합니다.
이렇게 트리 깊이에 상관없이 모든 노드를 자동으로 렌더링합니다.

---

### 폴더 열기/닫기 버그 수정 포인트

```js
// ✅ 수정 후 (현재 코드)
// 조상 노드만 열기 (자기 자신 제외)
const ancestors = parts.slice(0, -1);
ancestors.forEach(part => {
  // ...ancestors만 open
});
```

**`parts.slice(0, -1)`**
배열의 마지막 요소를 제외한 나머지.
`['PC', '언어', 'C'].slice(0, -1)` → `['PC', '언어']`

수정 전에는 자기 자신(`'C'`)도 포함해서 열었습니다. 그래서 클릭으로 닫아도 즉시 다시 열렸습니다.
수정 후: 클릭 핸들러의 `toggle()`이 열고/닫고를 결정하면, `_select()`는 그 결과를 건드리지 않습니다.

---

## 다음 파일

- **[12] toc.js** — 글 읽는 중 현재 섹션을 하이라이트하는 목차
