---
title: "[코드 해설 03] storage.js — 브라우저에 데이터 저장하기"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, localStorage, 저장소]
excerpt: 다크모드 설정이 새로고침 후에도 유지되는 이유. localStorage를 안전하게 쓰는 래퍼 패턴을 한 줄씩 설명합니다.
---

## 이 파일이 하는 일

블로그를 닫고 다시 열어도 다크모드, 선택한 컬러가 그대로 유지됩니다.  
이것을 가능하게 하는 게 **localStorage**입니다.

`storage.js`는 localStorage를 안전하게 감싸는 얇은 레이어예요.

---

## 전체 코드

먼저 전체 코드를 눈으로 훑어보세요. 아래에서 한 부분씩 잘라 설명합니다.

```javascript
const Storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Storage] 저장 실패:', key, e);
    }
  },

  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      console.warn('[Storage] 읽기 실패:', key, e);
      return defaultValue;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Storage] 삭제 실패:', key, e);
    }
  },
};

export default Storage;
```

---

---

## localStorage란?

브라우저가 제공하는 **영구 저장공간**입니다.  
탭을 닫아도, 컴퓨터를 꺼도 데이터가 남아요.

```javascript
// 직접 쓰는 방법
localStorage.setItem('theme', 'dark');
localStorage.getItem('theme'); // 'dark'
```

문제는 localStorage가 **문자열만 저장**한다는 거예요.  
숫자, 객체, 배열을 저장하려면 변환이 필요합니다.

---

## 전체 코드 구조

```javascript
const Storage = {
  set(key, value) { ... },       // 저장
  get(key, defaultValue) { ... }, // 읽기
  remove(key) { ... },            // 삭제
};
```

---

## set() — 저장

```javascript
set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[Storage] 저장 실패:', key, e);
  }
},
```

**한 줄씩 설명:**

`JSON.stringify(value)`  
→ 값을 **JSON 문자열**로 변환합니다.  
localStorage는 문자열만 저장할 수 있어서 이 변환이 필수예요.

| 원래 값 | JSON.stringify 후 |
|---------|------------------|
| `42` | `"42"` |
| `true` | `"true"` |
| `{a: 1}` | `'{"a":1}'` |
| `[1,2,3]` | `"[1,2,3]"` |

`try { ... } catch (e) { ... }`  
→ 오류가 날 수 있는 코드를 감쌉니다.  
브라우저 시크릿 모드나 용량 초과 시 localStorage가 실패할 수 있어요.  
오류가 나도 `catch`가 받아서 `console.warn`만 남기고 앱은 계속 동작합니다.

---

## get() — 읽기

```javascript
get(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.warn('[Storage] 읽기 실패:', key, e);
    return defaultValue;
  }
},
```

**한 줄씩 설명:**

`defaultValue = null`  
→ 함수 인자에 기본값을 설정합니다.  
`Storage.get('theme')` 처럼 두 번째 인자 없이 써도 `null`을 반환해요.

`const raw = localStorage.getItem(key)`  
→ 저장된 문자열을 가져옵니다.  
저장된 값이 없으면 `null`을 반환해요 (빈 문자열과 다름).

`raw !== null ? JSON.parse(raw) : defaultValue`  
→ 값이 있으면 **JSON으로 다시 변환**해서 원래 타입으로 복원합니다.  
없으면 기본값을 반환해요.

`JSON.parse(raw)` 도 실패할 수 있어요 (저장된 값이 JSON 형식이 아닌 경우).  
그래서 `try/catch`로 감싸야 합니다.

---

## remove() — 삭제

```javascript
remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[Storage] 삭제 실패:', key, e);
  }
},
```

간단합니다. 저장된 키를 삭제해요.

---

## 실제 사용 예시

```javascript
// theme.js에서
Storage.set('theme', 'dark');
const saved = Storage.get('theme', 'light'); // 없으면 'light'

// accent.js에서
Storage.set('accent_preset', 2); // 숫자도 저장 가능
const index = Storage.get('accent_preset', 0); // 없으면 0
```

---

## 왜 직접 쓰지 않고 래퍼를 만들었나?

`localStorage`를 직접 쓰면:
- 매번 `JSON.stringify`/`JSON.parse`를 직접 써야 함
- 매번 `try/catch`를 직접 써야 함
- 나중에 localStorage 대신 다른 저장소로 바꾸려면 모든 파일을 수정해야 함

`storage.js`를 거치면:
- 한 곳만 수정하면 모든 곳이 바뀜
- 코드가 훨씬 짧고 깔끔해짐
