---
title: "[코드 해설 09] search.js — 실시간 검색과 디바운스"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, 디바운스, 검색]
excerpt: 타이핑할 때마다 결과가 업데이트되지만 서버에 과도한 요청을 보내지 않는 비결. 디바운스 패턴을 설명합니다.
---

## 이 파일이 하는 일

검색창을 담당합니다:
- 글자를 입력하면 실시간으로 게시글이 필터링됨
- X 버튼으로 검색어 지우기
- `Escape` 키로 초기화
- `/` 키를 누르면 검색창으로 포커스 이동

---

## 디바운스란?

검색창에 "javascript"를 타이핑하면 키를 10번 누릅니다.  
키를 누를 때마다 검색을 실행하면 10번 실행되는데, 이건 낭비예요.

**디바운스(Debounce)**는 마지막 입력 후 일정 시간(여기서는 200ms)이 지나야 실행합니다:

```
j → 대기 200ms...
a → 다시 대기 200ms...
v → 다시 대기 200ms...
...
t → 200ms 경과 → 검색 실행!
```

마지막 글자 타이핑 후 200ms가 지나야만 검색이 실행됩니다.

---

## 디바운스 구현

```javascript
let debounce = null;

input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    const query = input.value.trim();
    App.emit('filter:search', { query });
  }, 200);
});
```

**한 줄씩 설명:**

`let debounce = null`  
→ 타이머 ID를 저장할 변수입니다. 초기에는 타이머가 없으니 `null`.

`clearTimeout(debounce)`  
→ 이전에 예약한 타이머를 취소합니다.  
새 글자를 입력할 때마다 이전 예약을 지워요.

`debounce = setTimeout(() => { ... }, 200)`  
→ 200ms 후에 실행할 작업을 예약합니다.  
200ms 안에 또 입력하면 위의 `clearTimeout`이 이 예약을 취소해요.

`input.value.trim()`  
→ 입력값에서 앞뒤 공백을 제거합니다.  
"  javascript  " → "javascript"

---

## X 버튼 (지우기)

```javascript
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    App.emit('filter:search', { query: '' });
    input.focus();
  });
}
```

X 버튼을 클릭하면:
1. 입력창 내용을 지우고
2. X 버튼 자신을 숨기고
3. 검색어를 빈 문자열로 발행 (전체 목록으로 복귀)
4. 검색창에 포커스 (계속 타이핑할 수 있도록)

---

## Escape 키 처리

```javascript
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    App.emit('filter:search', { query: '' });
    input.blur();
  }
});
```

`e.key === 'Escape'` → 눌린 키가 Escape인지 확인  
`input.blur()` → 포커스 해제 (검색창에서 나오기)

---

## '/' 단축키

```javascript
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

**한 줄씩 설명:**

`document.activeElement?.tagName`  
→ 현재 포커스된 요소의 태그 이름입니다.  
아무 곳도 포커스 안 됐으면 `null`이 되는데, `?.`로 안전하게 처리해요.

`isTyping` → 이미 어딘가에 타이핑 중인지 확인합니다.  
글을 쓰는 중에 `/`를 누르면 단축키가 아닌 실제 `/` 문자를 입력하는 거니까요.

`e.preventDefault()` → 기본 동작(슬래시 문자 입력)을 막습니다.

`input.select()` → 검색창의 모든 텍스트를 선택합니다.  
이미 뭔가 검색 중이었다면 바로 덮어쓸 수 있어요.

---

## 전체 흐름

```
사용자 타이핑
  → clearTimeout (이전 타이머 취소)
  → setTimeout 200ms 예약
  → 200ms 후: App.emit('filter:search', { query })
  → filter.js 수신
  → _applyFilter() 실행
  → App.emit('posts:filtered', { posts })
  → renderer.js 수신
  → 카드 목록 업데이트
```
