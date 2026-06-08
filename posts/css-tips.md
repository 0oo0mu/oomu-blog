---
title: CSS Flexbox & Grid 핵심 정리
date: 2026-05-20
category: 개발
tags: [CSS, 레이아웃, Flexbox, Grid]
---

## 왜 Flexbox와 Grid인가?

예전에는 CSS 레이아웃을 `float`이나 `position`으로 잡았는데, 정말 복잡하고 직관적이지 않았어요. 지금은 **Flexbox**와 **Grid**만 잘 알면 대부분의 레이아웃을 깔끔하게 만들 수 있습니다.

간단히 구분하면:
- **Flexbox** → 1차원 배치 (가로 한 줄 또는 세로 한 줄)
- **Grid** → 2차원 배치 (행과 열 동시에)

---

## Flexbox 핵심

### 기본 설정

```css
.container {
  display: flex; /* 이 한 줄로 자식 요소들이 가로로 나열됩니다 */
}
```

### 자주 쓰는 속성

```css
.container {
  display: flex;

  /* 주축 방향 (기본: row = 가로) */
  flex-direction: row;        /* 가로 배치 */
  flex-direction: column;     /* 세로 배치 */

  /* 주축 정렬 (가로 방향일 때 = 좌우) */
  justify-content: flex-start;    /* 왼쪽 정렬 */
  justify-content: center;        /* 가운데 정렬 */
  justify-content: space-between; /* 양 끝에 붙이고 나머지 균등 분배 */
  justify-content: space-around;  /* 각 요소 주변에 동일한 여백 */

  /* 교차축 정렬 (가로 방향일 때 = 상하) */
  align-items: stretch;  /* 교차축 방향으로 늘림 (기본값) */
  align-items: center;   /* 세로 가운데 정렬 */
  align-items: flex-end; /* 아래 정렬 */

  /* 줄바꿈 허용 (기본값 nowrap은 한 줄에 다 욱여넣음) */
  flex-wrap: wrap;
  gap: 1rem; /* 요소 사이 간격 */
}
```

### 가운데 정렬 (가장 많이 쓰는 패턴)

```css
.center-box {
  display: flex;
  justify-content: center; /* 가로 가운데 */
  align-items: center;     /* 세로 가운데 */
  height: 100vh;           /* 전체 화면 높이 */
}
```

---

## Grid 핵심

### 기본 설정

```css
.container {
  display: grid;

  /* 열(column) 정의: 3열, 각각 1:1:1 비율 */
  grid-template-columns: 1fr 1fr 1fr;

  /* 또는 repeat으로 반복 */
  grid-template-columns: repeat(3, 1fr);

  /* 자동으로 열 개수 조절 (반응형에 최고!) */
  /* minmax(250px, 1fr): 최소 250px, 최대 1fr */
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));

  gap: 1rem; /* 행과 열 모두 1rem 간격 */
  row-gap: 1rem;    /* 행 간격만 */
  column-gap: 2rem; /* 열 간격만 */
}
```

### 특정 셀에 걸치기

```css
.wide-item {
  grid-column: 1 / 3;  /* 1번 열부터 3번 열 직전까지 (2개 열 차지) */
  grid-row: 1 / 2;     /* 1번 행만 */
}

/* 또는 span으로 */
.wide-item {
  grid-column: span 2; /* 현재 위치에서 2칸 차지 */
}
```

---

## Flexbox vs Grid 언제 쓸까?

| 상황 | 추천 |
|------|------|
| 내비게이션 메뉴 (가로 나열) | Flexbox |
| 버튼을 세로/가로 가운데 정렬 | Flexbox |
| 카드 그리드 (갤러리) | Grid |
| 복잡한 페이지 전체 레이아웃 | Grid |
| 한 방향 배치 | Flexbox |
| 행과 열 동시에 제어 | Grid |

> 둘이 서로 배타적이지 않아요. 전체 레이아웃은 Grid로, 그 안의 요소는 Flexbox로 쓰는 게 일반적입니다.
