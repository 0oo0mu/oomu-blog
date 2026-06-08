---
title: "[코드 해설 05] accent.js — 8가지 컬러 프리셋"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, CSS변수, 디자인]
excerpt: 포인트 컬러를 바꾸면 버튼, 링크, 사이드바가 한꺼번에 바뀝니다. CSS 변수와 data-index 속성으로 구현하는 색상 테마 시스템.
---

## 이 파일이 하는 일

헤더의 색상 점(●)을 클릭하면 팝업이 열리고, 색상을 선택하면  
버튼, 링크, 사이드바 활성 항목 등 **모든 포인트 컬러**가 한꺼번에 바뀝니다.

---

## 핵심 원리: CSS 변수 교체

```css
/* CSS에서 --accent 변수를 사용 */
.sort-btn.active {
  background: var(--accent);
}

a {
  color: var(--accent);
}
```

JavaScript가 `--accent` 변수의 값만 바꾸면 이 변수를 쓰는 모든 요소가 자동으로 바뀌어요.

---

## 프리셋 목록

```javascript
const PRESETS = [
  { name: '인디고', accent: '#6366f1', light: 'rgba(99,102,241,0.13)'  },
  { name: '블루',   accent: '#3b82f6', light: 'rgba(59,130,246,0.13)'  },
  { name: '에메랄드', accent: '#10b981', light: 'rgba(16,185,129,0.13)' },
  { name: '티얼',   accent: '#06b6d4', light: 'rgba(6,182,212,0.13)'   },
  { name: '보라',   accent: '#8b5cf6', light: 'rgba(139,92,246,0.13)'  },
  { name: '핑크',   accent: '#ec4899', light: 'rgba(236,72,153,0.13)'  },
  { name: '로즈',   accent: '#f43f5e', light: 'rgba(244,63,94,0.13)'   },
  { name: '오렌지', accent: '#f97316', light: 'rgba(249,115,22,0.13)'  },
];
```

각 프리셋은 두 가지 색상을 가집니다:
- `accent`: 버튼, 링크 등 **강조 색상**
- `light`: 배경, 호버 등 **연한 배경 색상** (`rgba`의 마지막 숫자 `0.13`이 투명도)

---

## _apply() — CSS 변수 적용

```javascript
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
```

**한 줄씩 설명:**

`PRESETS[index]`  
→ 배열에서 인덱스로 프리셋을 가져옵니다.  
`PRESETS[0]`은 인디고, `PRESETS[1]`은 블루예요.

`if (!preset) return`  
→ 인덱스가 범위를 벗어나면 그냥 종료합니다. 방어 코드예요.

`document.documentElement.style.setProperty('--accent', preset.accent)`  
→ `<html>` 태그의 인라인 스타일로 CSS 변수를 설정합니다.  
인라인 스타일은 CSS 파일보다 우선순위가 높아서 기존 값을 덮어써요.

`document.querySelectorAll('.color-dot')`  
→ 페이지에 있는 모든 `.color-dot` 요소를 가져옵니다.  
헤더의 작은 색상 점들이에요. 선택한 색상으로 즉시 업데이트됩니다.

---

## _buildPopup() — 팝업 생성

```javascript
_buildPopup() {
  const popup = document.getElementById('colorPresetPopup');
  if (!popup) return;

  popup.innerHTML = PRESETS.map((p, i) => `
    <button
      class="preset-swatch ${i === this._current ? 'active' : ''}"
      data-index="${i}"
      title="${p.name}"
      style="background: ${p.accent};"
    ></button>
  `).join('');
},
```

**한 줄씩 설명:**

`PRESETS.map((p, i) => ...)`  
→ 프리셋 배열을 HTML 문자열 배열로 변환합니다.  
`map`은 "배열의 각 항목을 다른 형태로 변환해라"는 메서드예요.

`i === this._current ? 'active' : ''`  
→ 현재 선택된 프리셋이면 `active` 클래스를 추가합니다.  
CSS에서 `active` 클래스에 선택 표시(테두리 등)를 스타일링해요.

`data-index="${i}"`  
→ 버튼에 인덱스를 저장합니다.  
클릭했을 때 "몇 번 프리셋을 선택했는가"를 알기 위해서예요.

`.join('')`  
→ 배열을 하나의 문자열로 합칩니다.  
`['<button>A</button>', '<button>B</button>'].join('')` → `'<button>A</button><button>B</button>'`

---

## _bindEvents() — 이벤트 연결

```javascript
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
});
```

`parseInt(swatch.dataset.index, 10)`  
→ `data-index` 속성 값은 문자열이에요. 숫자로 변환합니다.  
두 번째 인자 `10`은 10진수 변환을 의미해요 (보통 생략하지만 명시적으로 씀).

`classList.toggle('active', i === index)`  
→ 두 번째 인자가 `true`이면 추가, `false`이면 제거합니다.  
선택된 스와치에만 `active` 클래스가 붙도록 업데이트해요.

---

## 팝업 바깥 클릭 닫기

```javascript
document.addEventListener('click', (e) => {
  if (!wrap.contains(e.target)) {
    popup.classList.remove('open');
  }
});
```

`wrap.contains(e.target)`  
→ 클릭한 요소가 `wrap` 안에 있는지 확인합니다.  
팝업 안을 클릭하면 `true`, 바깥을 클릭하면 `false`예요.  
바깥을 클릭했을 때만 팝업을 닫습니다.

---

## 정리

색상을 바꿀 때 일어나는 일:

```
스와치 클릭
  → data-index 읽기
  → PRESETS[index] 가져오기
  → <html> CSS 변수 교체 (--accent, --accent-light)
  → CSS 변수를 쓰는 모든 요소 자동 업데이트
  → Storage에 인덱스 저장
  → 팝업 닫기
```
