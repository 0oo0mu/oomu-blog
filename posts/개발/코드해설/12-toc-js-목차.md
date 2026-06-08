---
title: "[코드 해설 12] toc.js — 스크롤 따라 움직이는 목차"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, scroll, 목차]
excerpt: 글을 읽으면서 현재 섹션이 목차에 하이라이트됩니다. requestAnimationFrame으로 성능을 최적화하고, IntersectionObserver 대신 scroll 이벤트를 쓴 이유를 설명합니다.
---

# toc.js — 스크롤 따라 움직이는 목차

## 이 파일이 하는 일

글 상세 페이지 오른쪽에 목차(Table of Contents)가 있습니다.
스크롤하면 현재 읽고 있는 섹션이 목차에서 파란색으로 표시됩니다.

---

## 전체 코드

```js
const Toc = {
  _rafId: null,
  _scrollHandler: null,
  _headings: [],

  build({ bodyId = 'postBody', tocId = 'tocList', sidebarId = 'tocSidebar' } = {}) {
    this._cleanup();

    const body    = document.getElementById(bodyId);
    const tocList = document.getElementById(tocId);
    const sidebar = document.getElementById(sidebarId);
    if (!body || !tocList || !sidebar) return;

    const headings = Array.from(body.querySelectorAll('h2, h3, h4'));

    if (headings.length === 0) {
      sidebar.style.display = 'none';
      return;
    }

    sidebar.style.display = '';
    tocList.innerHTML = '';

    headings.forEach((heading, idx) => {
      const id = `h-${idx}-` + heading.textContent
        .toLowerCase()
        .replace(/[^\w\s가-힣]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 40);

      heading.id = id;

      const level = parseInt(heading.tagName[1]);
      const li = document.createElement('li');
      li.className = `toc-item level-${level}`;

      const a = document.createElement('a');
      a.href = `#${id}`;
      a.textContent = heading.textContent;

      a.addEventListener('click', (e) => {
        e.preventDefault();
        this._setActive(tocList, id);
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      li.appendChild(a);
      tocList.appendChild(li);
    });

    this._headings = headings;

    this._scrollHandler = () => {
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = requestAnimationFrame(() => {
        this._updateActive(tocList);
      });
    };

    window.addEventListener('scroll', this._scrollHandler, { passive: true });
    this._updateActive(tocList);
  },

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

  _setActive(tocList, id) {
    tocList.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
    const link = tocList.querySelector(`a[href="#${id}"]`);
    if (link) {
      link.classList.add('active');
      link.scrollIntoView({ block: 'nearest' });
    }
  },

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
};

export default Toc;
```

---

## 한 줄씩 설명

### `build` — 목차 생성

#### 파라미터 기본값

```js
build({ bodyId = 'postBody', tocId = 'tocList', sidebarId = 'tocSidebar' } = {}) {
```

`{ ... } = {}`는 구조분해 + 기본값입니다.
`Toc.build()` 처럼 인자 없이 호출해도 괜찮고, 일부만 넘겨도 됩니다.
예: `Toc.build({ bodyId: 'myBody' })` → tocId, sidebarId는 기본값 사용.

#### 이전 목차 정리

```js
this._cleanup();
```

글을 다시 로드하면 이전 스크롤 이벤트 리스너가 남아있을 수 있습니다.
`build()` 전에 먼저 청소합니다.

#### heading 찾기

```js
const headings = Array.from(body.querySelectorAll('h2, h3, h4'));
```

`querySelectorAll('h2, h3, h4')`: h2, h3, h4 태그를 모두 찾습니다.
`Array.from()`: NodeList(DOM 쿼리 결과)를 일반 배열로 변환합니다. `forEach` 등을 쓰기 위해.

h1을 포함하지 않는 이유: 포스트 제목이 h1이어서 목차에는 필요없습니다.

#### heading ID 생성

```js
const id = `h-${idx}-` + heading.textContent
  .toLowerCase()
  .replace(/[^\w\s가-힣]/g, '')
  .replace(/\s+/g, '-')
  .slice(0, 40);
```

**`heading.textContent`**
태그 안의 텍스트만 꺼냅니다. `<h2>제목 **굵게**</h2>` → `'제목 굵게'`

**`.toLowerCase()`**
소문자로 변환. `'JavaScript 입문'` → `'javascript 입문'`

**`.replace(/[^\w\s가-힣]/g, '')`**
`[^\w\s가-힣]`는 "영문자·숫자·언더스코어(`\w`), 공백(`\s`), 한글(`가-힣`)이 아닌 것"입니다.
`^`는 부정. 이에 해당하는 문자(특수문자, 이모지 등)를 제거합니다.

**`.replace(/\s+/g, '-')`**
하나 이상의 공백을 하이픈으로 변환합니다.
`'javascript 입문'` → `'javascript-입문'`

**`.slice(0, 40)`**
최대 40자까지만 사용합니다. ID가 너무 길어지는 것을 방지합니다.

최종 예시: `'h-0-javascript-입문'`

---

### `_updateActive` — 현재 섹션 계산

```js
_updateActive(tocList) {
  const headerHeight = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '60'
  );
  const threshold = window.scrollY + headerHeight + 16;
```

**`getComputedStyle(...).getPropertyValue('--header-height')`**
CSS 변수 `--header-height` 값을 JavaScript에서 읽는 방법입니다.
결과는 `'60px'` 같은 문자열이므로 `parseInt`로 숫자로 변환합니다.

**`threshold`**
현재 스크롤 위치(`window.scrollY`) + 헤더 높이 + 16px 여유.
이 선 위에 있는 heading = 이미 지나친 섹션.

```js
  let activeId = null;
  for (const heading of this._headings) {
    if (heading.offsetTop <= threshold) {
      activeId = heading.id;
    } else {
      break;
    }
  }
```

**`heading.offsetTop`**
페이지 맨 위로부터 이 heading까지의 거리(픽셀)입니다.

**알고리즘:**
headings를 위에서 아래 순으로 보면서, threshold보다 위에 있는 것들을 activeId로 계속 갱신합니다.
threshold보다 아래 heading을 만나면 `break`로 즉시 종료합니다 (이후는 볼 필요 없으니).
마지막으로 갱신된 `activeId` = 현재 읽고 있는 섹션.

---

### `requestAnimationFrame` — 성능 최적화

```js
this._scrollHandler = () => {
  if (this._rafId) cancelAnimationFrame(this._rafId);
  this._rafId = requestAnimationFrame(() => {
    this._updateActive(tocList);
  });
};
window.addEventListener('scroll', this._scrollHandler, { passive: true });
```

스크롤 이벤트는 1초에 수십~수백 번 발생합니다. 매번 `_updateActive`를 실행하면 성능이 나빠집니다.

`requestAnimationFrame(fn)`은 브라우저가 화면을 다시 그리기 직전에 `fn`을 실행합니다.
화면은 보통 1초에 60번 갱신됩니다. 즉 아무리 스크롤을 빠르게 해도 `_updateActive`는 초당 최대 60번만 실행됩니다.

`cancelAnimationFrame(this._rafId)`는 이전에 예약된 실행을 취소합니다.
스크롤 이벤트가 연속으로 오면 마지막 것만 실행됩니다. 디바운스와 비슷한 원리입니다.

**`{ passive: true }`**
"이 이벤트 핸들러는 스크롤을 막지 않을 것이다"라고 브라우저에 알립니다.
브라우저가 스크롤을 더 빠르게 처리할 수 있습니다.

---

### `_cleanup` — 메모리 누수 방지

```js
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

SPA에서 다른 글로 이동하면 `build()`가 다시 호출됩니다.
이전 스크롤 이벤트 리스너를 제거하지 않으면 오래된 리스너가 계속 쌓입니다.
이것을 **메모리 누수(Memory Leak)**라고 합니다.

`removeEventListener`로 정확히 같은 함수를 제거해야 합니다.
이 때문에 `this._scrollHandler`에 함수를 저장해둔 것입니다. 익명 함수는 제거할 수 없습니다.

---

## 왜 IntersectionObserver를 안 썼나

IntersectionObserver는 더 현대적인 API입니다. 그런데 이 상황에서 문제가 있습니다.

heading이 화면에 들어올 때만 감지합니다. 긴 섹션을 읽는 중에는 heading이 화면 위로 사라집니다.
사라지는 순간 감지는 되지만, 그 이후 어디까지 내려왔는지 알 수 없습니다.

스크롤 이벤트 + 오프셋 계산은 단순하지만 항상 정확합니다.
현재 스크롤 위치를 직접 보기 때문에 어떤 상황에서도 올바른 섹션을 알아냅니다.

---

## 다음 파일

- **[13] music-player.js** — 페이지 이동해도 음악이 끊기지 않는 뮤직 플레이어
