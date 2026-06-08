---
title: "[코드 해설 04] theme.js — 다크모드는 어떻게 동작하나"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, CSS, 다크모드]
excerpt: 버튼 하나로 전체 색상이 바뀌는 마법. classList.toggle과 CSS 변수로 다크모드를 구현하는 방법을 설명합니다.
---

## 이 파일이 하는 일

헤더의 🌙 버튼을 누르면 전체 화면이 어두워집니다.  
다시 누르면 밝아지고, 새로고침해도 설정이 유지돼요.

---

## 핵심 원리: HTML에 클래스 붙이기

```html
<!-- 라이트 모드 -->
<html>

<!-- 다크 모드 -->
<html class="dark">
```

JavaScript는 `<html>` 태그에 `dark` 클래스를 붙이거나 떼기만 합니다.  
CSS가 그 클래스를 감지해서 색상을 바꿔요.

```css
/* CSS에서 */
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
}

:root.dark {
  --bg: #0f0f0f;
  --text: #e5e5e5;
}
```

`:root.dark` = "html 태그에 dark 클래스가 있을 때"

---

## 전체 코드 구조

```javascript
const Theme = {
  init() { ... },    // 초기화
  toggle() { ... },  // 토글 (라이트 ↔ 다크)
  current() { ... }, // 현재 테마 반환
  _apply(theme) { ... },  // 실제 적용 (내부)
  _setButton(icon, label) { ... }, // 버튼 업데이트 (내부)
};
```

---

## init() — 초기화

```javascript
init() {
  const saved = Storage.get('theme', 'light');
  this._apply(saved);

  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', () => this.toggle());
},
```

**한 줄씩 설명:**

`Storage.get('theme', 'light')`  
→ 저장된 테마를 가져옵니다. 없으면 `'light'`를 기본값으로 사용해요.

`this._apply(saved)`  
→ 저장된 테마를 즉시 화면에 적용합니다.

`btn.addEventListener('click', () => this.toggle())`  
→ 버튼 클릭 시 toggle()을 실행하도록 연결합니다.

---

## toggle() — 전환

```javascript
toggle() {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  this._apply(next);
  Storage.set('theme', next);
  App.emit('theme:change', { theme: next });
},
```

**한 줄씩 설명:**

`document.documentElement.classList.contains('dark')`  
→ `<html>` 태그에 `dark` 클래스가 있는지 확인합니다.  
`document.documentElement` = `<html>` 요소  
`classList.contains('dark')` = dark 클래스가 있으면 `true`

`? 'light' : 'dark'`  
→ 삼항 연산자. "dark가 있으면 light로, 없으면 dark로"

`Storage.set('theme', next)`  
→ 선택을 localStorage에 저장합니다. 새로고침 후에도 유지돼요.

`App.emit('theme:change', { theme: next })`  
→ 다른 모듈에 "테마가 바뀌었어요!"라고 알립니다.  
차트나 캔버스 같은 요소들이 색상을 업데이트할 때 이 이벤트를 사용할 수 있어요.

---

## _apply() — 실제 적용

```javascript
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

**한 줄씩 설명:**

`document.documentElement.classList.add('dark')`  
→ `<html>` 태그에 `dark` 클래스를 추가합니다.  
이 순간 CSS의 `:root.dark { ... }` 규칙이 활성화돼요.

`classList.remove('dark')`  
→ `dark` 클래스를 제거합니다.

버튼 아이콘은 현재 모드의 **반대**를 표시합니다.  
다크 모드일 때는 "☀️ 라이트" (라이트로 바꾸겠다는 의미)  
라이트 모드일 때는 "🌙 다크" (다크로 바꾸겠다는 의미)

---

## 섬광 방지 (Flash of Unstyled Content)

페이지를 처음 열 때 JS가 실행되기 전 잠깐 하얀 화면이 번쩍이는 문제가 있어요.  
다크모드 사용자에게 특히 불쾌합니다.

이 블로그는 `index.html`의 `<head>`에 인라인 스크립트가 있습니다:

```html
<head>
  <script>
    // CSS 로드 전에 미리 dark 클래스 적용
    if (localStorage.getItem('theme') === '"dark"') {
      document.documentElement.classList.add('dark');
    }
  </script>
</head>
```

CSS보다 먼저 실행되어 화면이 그려지기 전에 다크 클래스를 붙입니다.  
이 덕분에 번쩍임 없이 처음부터 다크모드로 보입니다.

---

## 정리

| 단계 | 코드 | 설명 |
|------|------|------|
| 1 | `classList.add('dark')` | `<html>` 에 클래스 추가 |
| 2 | CSS `:root.dark` 규칙 활성화 | 자동으로 색상 변수 바뀜 |
| 3 | `Storage.set('theme', 'dark')` | 설정 저장 |
| 4 | 새로고침 | 저장된 값 읽어서 다시 적용 |
