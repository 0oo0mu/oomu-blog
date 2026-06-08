---
title: "[코드 해설 03] storage.js — 브라우저에 데이터 저장하기"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, localStorage, 저장]
excerpt: 다크모드 설정, 음악 재생 위치, 컬러 테마... 새로고침해도 기억하려면? localStorage를 안전하게 쓰는 래퍼 모듈을 한 줄씩 파헤칩니다.
---

# storage.js — 브라우저에 데이터 저장하기

## localStorage가 뭔가

웹사이트는 기본적으로 새로고침하면 모든 것이 초기화됩니다.
하지만 다크모드를 설정했는데 새로고침할 때마다 라이트모드로 돌아오면 불편하겠죠.

이를 해결하는 게 **localStorage**입니다. 브라우저 안에 있는 작은 메모장 같은 것으로, 새로고침해도 데이터가 남아 있습니다.

```js
// 저장
localStorage.setItem('theme', 'dark');

// 꺼내기
localStorage.getItem('theme');  // 'dark' 반환
```

그런데 직접 쓰면 몇 가지 문제가 있습니다.

1. **오류 처리가 없음:** 브라우저 설정으로 localStorage를 막아둔 사용자가 있으면 오류가 납니다.
2. **타입 문제:** localStorage는 문자열만 저장합니다. 숫자 `0.7`을 저장하면 문자열 `'0.7'`이 나옵니다.
3. **코드 중복:** 파일마다 try/catch를 써야 합니다.

`storage.js`는 이 문제들을 한 곳에서 해결합니다.

---

## 전체 코드

```js
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

## 한 줄씩 설명

### `set` — 저장

```js
set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[Storage] 저장 실패:', key, e);
  }
},
```

**`try { ... } catch (e) { ... }`**
"이걸 시도해봐. 오류가 나면 catch로 가"라는 구조입니다.
브라우저가 localStorage를 막아도 사이트가 멈추지 않고 경고만 출력합니다.

**`JSON.stringify(value)`**
localStorage는 문자열만 저장하므로 다른 타입을 문자열로 변환합니다.

| 원본 값 | JSON.stringify 결과 |
|---|---|
| `42` | `"42"` |
| `true` | `"true"` |
| `0.7` | `"0.7"` |
| `['JS', 'CSS']` | `"[\"JS\",\"CSS\"]"` |
| `{ theme: 'dark' }` | `"{\"theme\":\"dark\"}"` |

---

### `get` — 꺼내기

```js
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

**`defaultValue = null`**
함수를 호출할 때 기본값을 지정하지 않으면 자동으로 `null`이 됩니다.
`Storage.get('theme', 'light')` → 저장된 값이 없으면 `'light'` 반환.

**`const raw = localStorage.getItem(key)`**
저장된 문자열을 꺼냅니다. 키가 없으면 `null`을 반환합니다.

**`raw !== null ? JSON.parse(raw) : defaultValue`**
삼항연산자입니다. `조건 ? 참일때 : 거짓일때`
- `raw`가 null이 아니면(= 저장된 값이 있으면) → `JSON.parse(raw)`로 원래 타입 복원
- null이면(= 저장된 값이 없으면) → `defaultValue` 반환

**`JSON.parse(raw)`**
`JSON.stringify`의 반대. 문자열을 원래 타입으로 되돌립니다.

| 저장된 문자열 | JSON.parse 결과 |
|---|---|
| `"42"` | `42` (숫자) |
| `"true"` | `true` (불리언) |
| `"0.7"` | `0.7` (소수) |
| `"[\"JS\",\"CSS\"]"` | `['JS', 'CSS']` (배열) |

---

### `remove` — 삭제

```js
remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[Storage] 삭제 실패:', key, e);
  }
},
```

저장된 키를 삭제합니다. 뮤직 플레이어에서 재생 위치를 한 번 복원하고 나면 지워버릴 때 씁니다.

---

## 이 블로그에서 저장하는 데이터

| 키 | 저장 값 | 쓰는 파일 |
|---|---|---|
| `theme` | `'dark'` 또는 `'light'` | theme.js |
| `accent_preset` | `0` ~ `7` (프리셋 인덱스) | accent.js |
| `mp_index` | 현재 재생 중인 곡 번호 | music-player.js |
| `mp_time` | 재생 위치(초) | music-player.js |
| `mp_volume` | 볼륨 (0~1) | music-player.js |
| `mp_shuffle` | `true` 또는 `false` | music-player.js |
| `mp_repeat` | `'none'`, `'one'`, `'all'` | music-player.js |

---

## 다음 파일

- **[04] theme.js** — 다크모드/라이트모드 전환 방법
