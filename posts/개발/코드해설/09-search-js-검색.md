---
title: "[코드 해설 09] search.js — 실시간 검색과 디바운스"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, 검색, 디바운스]
excerpt: 타이핑할 때마다 검색하면 너무 느려집니다. 디바운스로 200ms를 기다렸다가 실행하는 방법을 한 줄씩 설명합니다.
---

# search.js — 실시간 검색과 디바운스

## 이 파일이 하는 일

검색창에 글자를 입력하면 실시간으로 결과가 바뀝니다.
search.js는 그 입력을 감지해서 `filter:search` 이벤트를 발행합니다.
실제 필터링은 filter.js가 담당합니다. 역할이 명확하게 분리되어 있습니다.

---

## 전체 코드

```js
import App from '../core/app.js';

const Search = {
  init() {
    const input    = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');
    if (!input) return;

    let debounce = null;

    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const query = input.value.trim();
        if (clearBtn) {
          clearBtn.style.display = query ? 'flex' : 'none';
        }
        App.emit('filter:search', { query });
      }, 200);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        App.emit('filter:search', { query: '' });
        input.focus();
      });
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        App.emit('filter:search', { query: '' });
        input.blur();
      }
    });

    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  },
};

export default Search;
```

---

## 한 줄씩 설명

### 요소 가져오기

```js
const input    = document.getElementById('searchInput');
const clearBtn = document.getElementById('searchClear');
if (!input) return;
```

검색 입력창과 X(지우기) 버튼을 HTML에서 가져옵니다.
`if (!input) return`은 입력창이 없으면 여기서 끝냅니다. 에디터 페이지처럼 검색창이 없는 곳에서 오류가 나지 않습니다.

---

### 디바운스

```js
let debounce = null;
```

타이머 ID를 저장하는 변수입니다. 초기값은 null.

**디바운스란?**

사용자가 "자바스크립트"를 타이핑하면 키보다 7번 눌립니다.
디바운스 없이 매 키 입력마다 검색하면 7번 필터링이 됩니다.
200ms 디바운스를 걸면 타이핑이 멈추고 0.2초 후 딱 한 번만 실행됩니다.

```js
input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    // 검색 실행
  }, 200);
});
```

**`input` 이벤트**
키보드 입력, 붙여넣기, 음성 입력 등 값이 바뀔 때마다 발생합니다.

**`clearTimeout(debounce)`**
이전에 예약해둔 타이머를 취소합니다.
'자'를 치면 200ms 타이머 시작 → '바'를 치면 그 타이머 취소 후 새 타이머 시작.
마지막 글자 '트'를 친 후 200ms가 지나야 비로소 실행됩니다.

**`debounce = setTimeout(() => { ... }, 200)`**
200ms 후 실행될 함수를 예약합니다. 타이머 ID를 `debounce`에 저장합니다.
(그래야 다음 입력 때 `clearTimeout`으로 취소할 수 있습니다)

---

### 검색 이벤트 발행

```js
const query = input.value.trim();
```

`input.value`는 입력창에 적힌 텍스트입니다.
`.trim()`은 앞뒤 공백을 제거합니다. `"  검색어  "` → `"검색어"`.

```js
if (clearBtn) {
  clearBtn.style.display = query ? 'flex' : 'none';
}
```

검색어가 있으면 X 버튼 보이기(`flex`), 없으면 숨기기(`none`).
`query ? 'flex' : 'none'` → 비어있지 않으면 'flex', 비어있으면 'none'.

```js
App.emit('filter:search', { query });
```

검색 이벤트 발행. filter.js가 이 이벤트를 받아서 포스트를 걸러냅니다.

---

### X 버튼으로 검색 초기화

```js
clearBtn.addEventListener('click', () => {
  input.value = '';
  clearBtn.style.display = 'none';
  App.emit('filter:search', { query: '' });
  input.focus();
});
```

- 입력창 값 비우기
- X 버튼 숨기기
- 빈 검색어로 이벤트 발행 (전체 목록 표시)
- `input.focus()`: X를 클릭한 후 바로 다시 타이핑할 수 있도록 입력창에 포커스

---

### Escape 키로 초기화

```js
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    App.emit('filter:search', { query: '' });
    input.blur();
  }
});
```

`keydown` 이벤트는 키가 눌릴 때 발생합니다.
`e.key`는 눌린 키의 이름입니다.
`input.blur()`: 포커스를 제거합니다. Esc를 누르면 검색창에서 나갑니다.

---

### `/` 키로 검색창 포커스 (단축키)

```js
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
  if (e.key === '/' && !isTyping) {
    e.preventDefault();
    input.focus();
    input.select();
  }
});
```

**`document.activeElement`**
현재 포커스된 요소입니다.
`?.tagName`의 `?.`는 "activeElement가 null이면 undefined 반환, 있으면 tagName 반환".

**`isTyping`**
현재 입력 중인 상태인지 확인합니다.
INPUT, TEXTAREA, SELECT 안에 있을 때 `/`를 치면 그냥 `/` 문자가 입력되어야 합니다.

**`!isTyping`**
타이핑 중이 아닐 때만 단축키가 동작합니다.

**`e.preventDefault()`**
브라우저 기본 동작 막기. `/`를 입력창 안에 문자로 입력하는 것을 막습니다.

**`input.select()`**
검색창 포커스 + 기존 텍스트 전체 선택. 바로 새 검색어를 타이핑할 수 있습니다.

---

## 흐름 정리

```
'/' 키 누름 (글 읽는 중)
   │
   ▼
검색창 포커스 + 기존 내용 선택

타이핑 시작
   │
   ├── input 이벤트 발생
   ├── 이전 타이머 취소 (clearTimeout)
   └── 200ms 타이머 시작

200ms 후 (타이핑 멈춤)
   │
   ▼
query 추출 (trim)
   │
   ▼
App.emit('filter:search', { query })
   │
   ▼
filter.js 수신 → 포스트 필터링 → renderer.js 카드 업데이트
```

---

## 다음 파일

- **[10] renderer.js** — 포스트 카드를 HTML로 그리기
