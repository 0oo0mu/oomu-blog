---
title: "[코드 해설 12] toc.js — 스크롤 따라가는 목차"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, 스크롤, IntersectionObserver]
excerpt: 게시글을 스크롤하면 오른쪽 목차에서 현재 읽는 섹션이 강조됩니다. scroll 이벤트와 requestAnimationFrame으로 구현하는 방법을 설명합니다.
---

## 이 파일이 하는 일

게시글 페이지 오른쪽에 목차가 표시됩니다.  
스크롤하면 현재 보고 있는 섹션의 목차 항목이 강조(bold/색상)됩니다.  
목차를 클릭하면 해당 섹션으로 부드럽게 이동합니다.

---

## build() — 목차 생성

```javascript
build({ bodyId = 'postBody', tocId = 'tocList', sidebarId = 'tocSidebar' } = {}) {
  this._cleanup();

  const body = document.getElementById(bodyId);
  const headings = Array.from(body.querySelectorAll('h2, h3, h4'));

  if (headings.length === 0) {
    sidebar.style.display = 'none';
    return;
  }
  ...
}
```

`{ bodyId = 'postBody', ... } = {}` → 인자를 객체로 받고 기본값을 설정합니다.  
인자 없이 `Toc.build()`만 호출해도 동작해요.

`body.querySelectorAll('h2, h3, h4')` → `h2`, `h3`, `h4` 태그를 모두 찾습니다.  
`h1`은 제목으로 사용되므로 제외해요.

`Array.from(...)` → `NodeList`를 배열로 변환합니다.  
NodeList는 배열처럼 생겼지만 `map`, `filter` 같은 메서드가 없어요.

---

## heading에 id 부여하기

```javascript
const id = `h-${idx}-` + heading.textContent
  .toLowerCase()
  .replace(/[^\w\s가-힣]/g, '')
  .replace(/\s+/g, '-')
  .slice(0, 40);

heading.id = id;
```

각 `h2`/`h3`/`h4`에 고유 id를 붙입니다.  
목차 링크가 `#id`로 연결돼야 클릭 시 해당 위치로 이동할 수 있어요.

`heading.textContent.toLowerCase()` → 텍스트를 소문자로  
`.replace(/[^\w\s가-힣]/g, '')` → 한글, 영문, 숫자, 공백 외 특수문자 제거  
`.replace(/\s+/g, '-')` → 공백을 하이픈으로 (URL 안전)  
`.slice(0, 40)` → 최대 40자로 제한

"## 이 파일이 하는 일" → `"h-0-이-파일이-하는-일"`

---

## 스크롤 감지

```javascript
this._scrollHandler = () => {
  if (this._rafId) cancelAnimationFrame(this._rafId);
  this._rafId = requestAnimationFrame(() => {
    this._updateActive(tocList);
  });
};

window.addEventListener('scroll', this._scrollHandler, { passive: true });
```

**왜 requestAnimationFrame을 쓰나?**

스크롤 이벤트는 초당 수십 번 발생합니다. 그때마다 DOM을 업데이트하면 느려요.  
`requestAnimationFrame`은 "다음 화면 그리기 때 한 번만 실행해"라는 뜻입니다.  
스크롤 중에는 프레임당 최대 1번만 실행되도록 제한해요.

`cancelAnimationFrame(this._rafId)` → 이전에 예약한 게 있으면 취소  
(스크롤이 빠르면 이전 예약이 실행되기 전에 새 예약을 걸어요)

`{ passive: true }` → 브라우저에 "이 핸들러는 스크롤을 막지 않아요"라고 알립니다.  
스크롤 성능을 개선하는 힌트예요.

---

## _updateActive() — 현재 섹션 계산

```javascript
_updateActive(tocList) {
  const headerHeight = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '60'
  );
  const threshold = window.scrollY + headerHeight + 16;

  let activeId = null;
  for (const heading of this._headings) {
    if (heading.offsetTop <= threshold) {
      activeId = heading.id;
    } else {
      break;
    }
  }

  if (activeId) {
    this._setActive(tocList, activeId);
  }
},
```

**알고리즘:**

```
기준선 = 현재 스크롤 위치 + 헤더 높이 + 여유 16px

기준선보다 위에 있는 헤딩들 중 가장 마지막 것 = 현재 섹션
```

예를 들어 300px 스크롤했고 헤더가 60px면:  
기준선 = 300 + 60 + 16 = 376px

| heading | offsetTop | 기준선 376보다 위? |
|---------|-----------|----------------|
| h-0 | 100px | ✅ → activeId = h-0 |
| h-1 | 250px | ✅ → activeId = h-1 |
| h-2 | 400px | ❌ → break |

→ h-1이 현재 섹션

`getComputedStyle(...).getPropertyValue('--header-height')` → CSS 변수 값을 JS에서 읽습니다.

---

## _cleanup() — 정리

```javascript
_cleanup() {
  if (this._scrollHandler) {
    window.removeEventListener('scroll', this._scrollHandler);
    this._scrollHandler = null;
  }
  if (this._rafId) {
    cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }
  this._headings = [];
},
```

다른 게시글을 열면 이전 목차를 정리합니다.  
`removeEventListener`로 스크롤 핸들러를 제거하지 않으면  
이전 게시글의 heading id를 계속 찾아서 **메모리 누수**가 일어나요.

이렇게 이벤트 리스너를 직접 해제하는 것을 **cleanup** 패턴이라고 합니다.
