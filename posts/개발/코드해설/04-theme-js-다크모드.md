---
title: "[코드 해설 04] theme.js — 다크모드는 어떻게 동작하나"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, CSS, 다크모드]
excerpt: 버튼 하나로 전체 색상이 바뀌는 다크모드. body가 아닌 html에 클래스를 붙이는 이유, 섬광 방지까지 한 줄씩 설명합니다.
---

# theme.js — 다크모드는 어떻게 동작하나

## 다크모드의 원리

다크모드는 CSS 변수(Custom Property)로 구현합니다.

```css
/* css/variables.css */
:root {
  --bg: #ffffff;       /* 배경색 */
  --text: #1a1a1a;     /* 글자색 */
}

:root.dark {
  --bg: #0d0d0d;
  --text: #e0e0e0;
}
```

`<html>` 태그에 `dark` 클래스가 붙으면 `:root.dark` 규칙이 적용되어 변수가 교체됩니다.
페이지 전체가 이 변수를 쓰고 있으므로 클래스 하나만 붙이면 전체 색상이 바뀝니다.

---

## 전체 코드

```js
import Storage from './storage.js';
import App from './app.js';

const STORAGE_KEY = 'theme';

const Theme = {
  init() {
    const saved = Storage.get(STORAGE_KEY, 'light');
    this._apply(saved);

    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => this.toggle());
  },

  toggle() {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    this._apply(next);
    Storage.set(STORAGE_KEY, next);
    App.emit('theme:change', { theme: next });
  },

  current() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  },

  _apply(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      this._setButton('☀️', '라이트');
    } else {
      document.documentElement.classList.remove('dark');
      this._setButton('🌙', '다크');
    }
  },

  _setButton(icon, label) {
    const iconEl  = document.getElementById('themeIcon');
    const labelEl = document.getElementById('themeLabel');
    if (iconEl)  iconEl.textContent  = icon;
    if (labelEl) labelEl.textContent = label;
  },
};

export default Theme;
```

---

## 한 줄씩 설명

### 가져오기

```js
import Storage from './storage.js';
import App from './app.js';
```

[03] storage.js에서 만든 Storage 도구와, [01] app.js의 이벤트 버스를 불러옵니다.

```js
const STORAGE_KEY = 'theme';
```

localStorage에 저장할 때 쓸 키 이름입니다. 오타를 방지하기 위해 상수로 선언합니다.
이 값을 여러 곳에서 쓴다면, 오타가 나도 한 곳만 고치면 됩니다.

---

### `init` — 초기화

```js
init() {
  const saved = Storage.get(STORAGE_KEY, 'light');
  this._apply(saved);
```

페이지가 로드될 때 실행됩니다.
`Storage.get('theme', 'light')` — 저장된 테마를 가져오고, 없으면 'light'를 기본값으로 씁니다.
가져온 테마를 즉시 적용합니다.

```js
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', () => this.toggle());
},
```

HTML에서 id가 `themeToggle`인 버튼을 찾아서 클릭 이벤트를 연결합니다.
`if (btn)`은 "버튼이 있을 때만 연결"입니다. 버튼이 없는 페이지에서 오류가 나지 않습니다.

---

### `toggle` — 전환

```js
toggle() {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
```

`document.documentElement`는 `<html>` 태그입니다.
`classList.contains('dark')`는 "현재 dark 클래스가 붙어있냐?"를 확인합니다.
붙어있으면(= 지금 다크) → 'light'로 전환
없으면(= 지금 라이트) → 'dark'로 전환

```js
  this._apply(next);
  Storage.set(STORAGE_KEY, next);
  App.emit('theme:change', { theme: next });
},
```

1. 새 테마 적용
2. localStorage에 저장 (새로고침 후에도 유지)
3. 이벤트 발행 (다른 모듈이 테마 변경에 반응할 수 있도록)

---

### `_apply` — 실제 클래스 적용

```js
_apply(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    this._setButton('☀️', '라이트');
  } else {
    document.documentElement.classList.remove('dark');
    this._setButton('🌙', '다크');
  }
},
```

`<html>` 태그에 `dark` 클래스를 붙이거나 떼고, 버튼 아이콘도 업데이트합니다.

다크모드일 때는 "☀️ 라이트" 버튼 (클릭하면 라이트로 전환한다는 의미)
라이트모드일 때는 "🌙 다크" 버튼

---

## 왜 `<body>`가 아닌 `<html>`에 클래스를 붙이나?

이 블로그에는 **섬광 방지** 코드가 있습니다. 각 HTML 파일 `<head>` 안에 이런 스크립트가 있습니다.

```html
<head>
  <script>
    // CSS가 로드되기 전에 실행됨
    if (localStorage.getItem('theme') === '"dark"') {
      document.documentElement.classList.add('dark');
    }
  </script>
  <link rel="stylesheet" href="css/variables.css"> <!-- 나중에 로드됨 -->
</head>
```

HTML을 위에서부터 읽으면 `<head>` 안 스크립트가 CSS보다 먼저 실행됩니다.
이 시점에 `document.body`는 아직 null입니다. `<body>` 태그가 파싱되지 않았거든요.
하지만 `document.documentElement`(`<html>`)는 항상 존재합니다.

결과: CSS가 로드되는 순간 이미 `<html>`에 `dark` 클래스가 붙어있어서 처음부터 다크 색상이 적용됩니다. 흰 화면이 잠깐 보이는 **섬광(FOUC)**이 없습니다.

---

## 흐름 정리

```
페이지 로드
   │
   ▼
<head>의 인라인 스크립트 실행
   → localStorage 확인 → <html>에 즉시 dark 클래스 붙임
   │
   ▼
CSS 로드 (이미 dark 클래스 있으므로 처음부터 다크 색상)
   │
   ▼
Theme.init() 실행
   → Storage에서 저장된 테마 확인 → _apply() → 버튼 아이콘 설정

테마 버튼 클릭
   │
   ▼
toggle()
   → 현재 클래스 확인 → _apply() → Storage.set() → App.emit()
```

---

## 다음 파일

- **[05] accent.js** — 8가지 컬러 테마 프리셋
