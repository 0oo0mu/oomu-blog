---
title: "[코드 해설 11] sidebar.js — 폴더 트리 만들기"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, 재귀, 트리구조]
excerpt: 폴더 경로 문자열을 받아서 계층 구조 트리를 만드는 방법. 재귀 함수로 중첩 폴더를 처리하는 로직을 설명합니다.
---

## 이 파일이 하는 일

왼쪽 사이드바의 카테고리 트리를 담당합니다:
- 게시글의 `category` 필드("개발/코드해설")를 파싱해서 폴더 구조 생성
- 클릭하면 해당 카테고리 필터 적용
- 폴더 열기/닫기 토글
- 하위 폴더 게시글 수를 부모에 합산해서 표시

---

## 카테고리 → 트리 구조 변환

게시글마다 이런 `category` 값이 있습니다:
```
"개발"
"개발/코드해설"
"개발/팁"
"일상"
```

이것을 이런 트리 구조로 변환해요:

```
전체 (4)
├── 개발 (3)
│   ├── 코드해설 (1)
│   └── 팁 (1)
└── 일상 (1)
```

---

## 트리 데이터 구조 만들기

```javascript
const root = { _posts: posts.length, _children: {} };

posts.forEach(post => {
  if (!post.category) return;
  const parts = post.category.split('/').filter(Boolean);
  let node = root;

  parts.forEach((part, depth) => {
    if (!node._children[part]) {
      node._children[part] = { _posts: 0, _children: {} };
    }
    if (depth === parts.length - 1) {
      node._children[part]._posts++;
    }
    node = node._children[part];
  });
});
```

**"개발/코드해설" 처리 과정:**

1. `"개발/코드해설".split('/')` → `['개발', '코드해설']`
2. 첫 번째 반복 `part = '개발'`:  
   - `root._children['개발']` 없으면 생성  
   - 마지막이 아니므로 `_posts` 증가 안 함  
   - `node`를 `개발` 노드로 이동
3. 두 번째 반복 `part = '코드해설'`:  
   - `개발._children['코드해설']` 없으면 생성  
   - 마지막이므로 `_posts++`  
   - `node`를 `코드해설` 노드로 이동

결과:
```javascript
{
  _posts: 전체수,
  _children: {
    '개발': {
      _posts: 0, // 개발 폴더 직접 게시글 없음
      _children: {
        '코드해설': { _posts: 1, _children: {} }
      }
    }
  }
}
```

---

## calcTotal() — 하위 포함 합계 계산

```javascript
function calcTotal(node) {
  const childrenTotal = Object.values(node._children).reduce((sum, child) => {
    return sum + calcTotal(child);
  }, 0);
  node._total = node._posts + childrenTotal;
  return node._total;
}
```

**재귀 함수입니다.** 자기 자신을 호출해요.

`Object.values(node._children)` → 자식 노드들의 배열  
`.reduce((sum, child) => sum + calcTotal(child), 0)` → 각 자식을 재귀적으로 계산해서 합산  
`node._total = node._posts + childrenTotal` → 직접 게시글 + 하위 게시글 합계

`개발` 폴더의 경우:
- `개발._posts` = 0 (직접 게시글 없음)
- `코드해설._total` = 1
- `개발._total` = 0 + 1 = 1

---

## _renderNode() — 재귀 DOM 렌더링

```javascript
_renderNode(name, node, parentPath) {
  const fullPath = parentPath ? `${parentPath}/${name}` : name;
  const hasChildren = Object.keys(node._children).length > 0;

  const li = document.createElement('li');
  li.dataset.path = fullPath;

  // 버튼 생성 ...

  if (hasChildren) {
    const ul = document.createElement('ul');
    Object.entries(node._children).forEach(([childName, childNode]) => {
      ul.appendChild(this._renderNode(childName, childNode, fullPath));
    });
    li.appendChild(ul);
  }

  return li;
},
```

자식이 있으면 그 자식도 `_renderNode()`로 만들어서 추가합니다.  
자식의 자식도 같은 방식으로 처리해요.  
이것이 **재귀(Recursion)**입니다.

`fullPath` = 부모 경로 + "/" + 현재 이름  
예: `parentPath = "개발"`, `name = "코드해설"` → `fullPath = "개발/코드해설"`

---

## 조상 노드만 펼치기

```javascript
if (category !== 'all') {
  const parts = category.split('/');
  const ancestors = parts.slice(0, -1); // 자기 자신 제외
  let cur = '';
  ancestors.forEach(part => {
    cur = cur ? `${cur}/${part}` : part;
    const node = treeEl.querySelector(`[data-path="${cur}"]`);
    if (node) node.classList.add('open');
  });
}
```

`parts.slice(0, -1)` → 마지막 요소를 제외한 배열  
`"개발/코드해설".split('/')` = `['개발', '코드해설']`  
`.slice(0, -1)` = `['개발']` → 부모인 "개발"만 펼침

자기 자신(`코드해설`)은 클릭 핸들러의 `toggle()`로 이미 처리됐기 때문에 건드리지 않아요.  
여기서도 열면 토글이 의미 없어지거든요.
