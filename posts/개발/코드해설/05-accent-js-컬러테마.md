---
title: "[코드 해설 05] accent.js — 8가지 컬러 프리셋"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, CSS변수, 테마]
excerpt: 인디고, 블루, 에메랄드... 8가지 색상 프리셋을 CSS 변수 교체로 구현하는 방법을 한 줄씩 설명합니다.
---

# accent.js — 8가지 컬러 프리셋

## 이 파일이 하는 일

헤더 오른쪽 색상 점을 클릭하면 블로그 포인트 컬러가 바뀝니다.
인디고, 블루, 에메랄드, 티얼, 보라, 핑크, 로즈, 오렌지 — 8가지 프리셋입니다.

theme.js와 원리가 같습니다. CSS 변수(`--accent`, `--accent-light`)를 교체합니다.

---

## 프리셋 목록

```js
const PRESETS = [
  { name: '인디고',   accent: '#6366f1', light: 'rgba(99,102,241,0.13)'  },
  { name: '블루',     accent: '#3b82f6', light: 'rgba(59,130,246,0.13)'  },
  { name: '에메랄드', accent: '#10b981', light: 'rgba(16,185,129,0.13)'  },
  { name: '티얼',     accent: '#06b6d4', light: 'rgba(6,182,212,0.13)'   },
  { name: '보라',     accent: '#8b5cf6', light: 'rgba(139,92,246,0.13)'  },
  { name: '핑크',     accent: '#ec4899', light: 'rgba(236,72,153,0.13)'  },
  { name: '로즈',     accent: '#f43f5e', light: 'rgba(244,63,94,0.13)'   },
  { name: '오렌지',   accent: '#f97316', light: 'rgba(249,115,22,0.13)'  },
];
```

각 프리셋은 두 가지 색을 가집니다.
- `accent`: 버튼, 링크, 강조에 쓰이는 진한 색
- `light`: 배경, 호버에 쓰이는 연한 색 (`rgba`의 마지막 숫자 `0.13`이 투명도 13%)

---

## 전체 코드

```js
import Storage from './storage.js';

const STORAGE_KEY = 'accent_preset';

const Accent = {
  _current: 0,

  init() {
    this._current = Storage.get(STORAGE_KEY, 0);
    if (this._current < 0 || this._current >= PRESETS.length) {
      this._current = 0;
    }
    this._apply(this._current);
    this._buildPopup();
    this._bindEvents();
  },

  _apply(index) {
    const preset = PRESETS[index];
    if (!preset) return;
    const root = document.documentElement;
    root.style.setProperty('--accent',       preset.accent);
    root.style.setProperty('--accent-light', preset.light);
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.style.background = preset.accent;
    });
  },

  _buildPopup() {
    const popup = document.getElementById('colorPresetPopup');
    if (!popup) return;
    popup.innerHTML = PRESETS.map((p, i) => `
      <button
        class="preset-swatch ${i === this._current ? 'active' : ''}"
        data-index="${i}"
        title="${p.name}"
        style="background: ${p.accent};">
      </button>
    `).join('');
  },

  _bindEvents() {
    const btn   = document.getElementById('colorPresetBtn');
    const popup = document.getElementById('colorPresetPopup');
    const wrap  = document.getElementById('colorPresetWrap');
    if (!btn || !popup || !wrap) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = popup.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
    });

    popup.addEventListener('click', (e) => {
      const swatch = e.target.closest('.preset-swatch');
      if (!swatch) return;
      const index = parseInt(swatch.dataset.index, 10);
      this._current = index;
      this._apply(index);
      Storage.set(STORAGE_KEY, index);
      popup.querySelectorAll('.preset-swatch').forEach((s, i) => {
        s.classList.toggle('active', i === index);
      });
      popup.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        popup.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  },
};

export { PRESETS };
export default Accent;
```

---

## 한 줄씩 설명

### `_apply` — CSS 변수 교체

```js
_apply(index) {
  const preset = PRESETS[index];
  if (!preset) return;
```

`PRESETS[index]`로 해당 프리셋 객체를 가져옵니다.
`if (!preset) return`은 "없으면 여기서 함수 종료"입니다. 이상한 인덱스에서 오류를 방지합니다.

```js
  const root = document.documentElement;
  root.style.setProperty('--accent',       preset.accent);
  root.style.setProperty('--accent-light', preset.light);
```

`document.documentElement`는 `<html>` 태그입니다.
`style.setProperty('변수명', '값')`으로 CSS 변수를 직접 교체합니다.

예: `root.style.setProperty('--accent', '#3b82f6')`
→ CSS에서 `var(--accent)`를 쓰는 모든 곳이 즉시 `#3b82f6`(블루)으로 바뀝니다.

```js
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.style.background = preset.accent;
  });
```

헤더에 있는 색상 점 버튼도 선택된 색으로 업데이트합니다.
`querySelectorAll`은 조건에 맞는 요소를 **모두** 찾습니다 (getElementById는 하나만).
`forEach`로 찾은 모든 점의 배경색을 바꿉니다.

---

### `_buildPopup` — 팝업 버튼 생성

```js
_buildPopup() {
  const popup = document.getElementById('colorPresetPopup');
  if (!popup) return;

  popup.innerHTML = PRESETS.map((p, i) => `
    <button
      class="preset-swatch ${i === this._current ? 'active' : ''}"
      data-index="${i}"
      title="${p.name}"
      style="background: ${p.accent};">
    </button>
  `).join('');
},
```

**`PRESETS.map((p, i) => ...)`**
`map`은 배열의 각 항목을 변환합니다. `p`는 각 프리셋 객체, `i`는 인덱스(0~7)입니다.
각 프리셋마다 `<button>` HTML 문자열을 만듭니다.

**`i === this._current ? 'active' : ''`**
삼항연산자. 현재 선택된 프리셋이면 `active` 클래스 추가, 아니면 빈 문자열.

**`data-index="${i}"`**
HTML 커스텀 속성. 나중에 클릭할 때 몇 번 프리셋인지 알기 위해 심어둡니다.
JavaScript에서는 `element.dataset.index`로 꺼낼 수 있습니다.

**`.join('')`**
`map`이 만든 문자열 배열을 하나의 문자열로 합칩니다.
`['<button>...</button>', '<button>...</button>']` → `'<button>...</button><button>...</button>'`

---

### `_bindEvents` — 이벤트 연결

#### 팝업 열기/닫기

```js
btn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = popup.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen);
});
```

**`e.stopPropagation()`**
클릭 이벤트가 부모 요소로 전파되는 것을 막습니다.
막지 않으면 버튼 클릭 이벤트가 document 클릭 이벤트도 발동시켜서, 팝업을 열자마자 닫혀버립니다.

**`popup.classList.toggle('open')`**
`open` 클래스가 없으면 추가, 있으면 제거. 반환값은 추가했으면 true, 제거했으면 false.

**`btn.setAttribute('aria-expanded', isOpen)`**
접근성(스크린리더) 속성입니다. 팝업이 열려있으면 `aria-expanded="true"`.

---

#### 색상 선택

```js
popup.addEventListener('click', (e) => {
  const swatch = e.target.closest('.preset-swatch');
  if (!swatch) return;

  const index = parseInt(swatch.dataset.index, 10);
```

팝업 전체에 클릭 이벤트를 달아서(이벤트 위임), 각 스와치 버튼에 일일이 달지 않습니다.
클릭된 게 `.preset-swatch`가 아니면 무시합니다.

`swatch.dataset.index`는 문자열 `'3'` 같은 형태입니다.
`parseInt('3', 10)`으로 숫자 `3`으로 변환합니다. `10`은 10진수라는 뜻입니다.

```js
  this._current = index;
  this._apply(index);
  Storage.set(STORAGE_KEY, index);
```

선택된 프리셋을 적용하고, localStorage에 저장합니다.

```js
  popup.querySelectorAll('.preset-swatch').forEach((s, i) => {
    s.classList.toggle('active', i === index);
  });
```

`classList.toggle(클래스, 조건)` — 두 번째 인자가 true면 추가, false면 제거.
선택된 스와치에만 `active` 클래스, 나머지는 제거합니다.

---

#### 바깥 클릭으로 팝업 닫기

```js
document.addEventListener('click', (e) => {
  if (!wrap.contains(e.target)) {
    popup.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
});
```

`wrap.contains(e.target)` — 클릭된 요소가 `wrap` 안에 있냐?
아니면(팝업 바깥 클릭) → 팝업 닫기.

---

### `export { PRESETS }; export default Accent;`

`export default`는 기본 내보내기(import 시 이름 자유롭게 설정).
`export { PRESETS }`는 추가 내보내기. 빌드 스크립트에서 프리셋 목록이 필요할 때 씁니다.

---

## 다음 파일

- **[06] env.js** — 로컬 개발 환경과 배포 환경 구분하기
