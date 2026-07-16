---
title: [블로그 만들기] 부록 B. CSS 전체 (14개 파일)
date: 2026-07-14
category: 개발/블로그만들기
tags: [블로그만들기, 부록, CSS, 전체코드]
excerpt: 디자인 변수부터 각 화면 스타일까지, 이 블로그의 CSS 14개 파일 전체입니다. variables.css를 가장 먼저 연결하고 나머지를 이어 붙이세요.
---

# 부록 B — CSS 전체 (14개 파일)

디자인 변수부터 각 화면 스타일까지, 이 블로그의 CSS 14개 파일 전체입니다. variables.css를 가장 먼저 연결하고 나머지를 이어 붙이세요.

> 이 부록은 **실제 파일의 완전한 코드**입니다. 각 파일이 왜 그렇게 동작하는지는 해당 본편(00~20)에서 설명했고, 여기서는 그대로 옮겨 적을 수 있도록 전체를 싣습니다. 파일 경로 그대로 만들어 붙여넣으면 됩니다.

## `css/variables.css`

````css
/* =============================================
   css/variables.css — CSS 디자인 토큰 (변수)

   모든 색상, 크기, 폰트를 여기서 관리합니다.
   새 테마를 추가하려면 이 파일만 수정하세요.
   ============================================= */

/* ── 라이트 모드 기본값 ── */
:root {
  /* 포인트 컬러 (JS에서 --accent를 바꾸면 전체 반영) */
  --accent:       #6366f1;
  --accent-light: rgba(99, 102, 241, 0.12);

  /* 배경 */
  --bg:           #ffffff;
  --bg-card:      #f8fafc;
  --bg-code:      #f1f5f9;

  /* 텍스트 */
  --text:         #1e293b;
  --text-muted:   #64748b;
  --text-heading: #0f172a;

  /* 구분선 / 그림자 */
  --border:       #e2e8f0;
  --shadow:       0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);

  /* 레이아웃 */
  --sidebar-left:   220px;  /* 왼쪽 카테고리 사이드바 (index + post 공통) */
  --sidebar-width:  240px;  /* 오른쪽 ToC 사이드바 */
  --header-height:  60px;
  --layout-padding: 2rem;   /* 페이지 좌우 패딩 (양쪽 동일하게 유지해야 흔들리지 않음) */

  /* 폰트 */
  --font:      'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-code: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;

  /* 트랜지션 */
  --transition: 0.2s ease;
}

/* ── 다크 모드 ──
   :root.dark 를 사용합니다.
   인라인 스크립트가 CSS 로드 전에 <html>에 dark 클래스를 붙이기 때문에
   body.dark 대신 :root.dark 를 씁니다. (섬광 방지) */
:root.dark {
  --bg:           #0f172a;
  --bg-card:      #1e293b;
  --bg-code:      #0d1526;
  --text:         #e2e8f0;
  --text-muted:   #94a3b8;
  --text-heading: #f1f5f9;
  --border:       #334155;
  --shadow:       0 1px 3px rgba(0,0,0,0.4);
  --accent-light: rgba(99, 102, 241, 0.15);
}
````


## `css/base.css`

````css
/* =============================================
   css/base.css — 리셋 + 기본 요소 스타일

   전역 리셋과 a, code, body 같은 기본 HTML
   요소의 기본 스타일을 정의합니다.
   ============================================= */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth; /* 앵커 클릭 시 부드럽게 스크롤 */
}

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.7;
  min-height: 100vh;
  transition: background var(--transition), color var(--transition);
  overflow-x: clip; /* 페이지 가로 스크롤 방지 (clip은 sticky를 깨지 않음) */
}

a {
  color: var(--accent);
  text-decoration: none;
  transition: opacity var(--transition);
}
a:hover { opacity: 0.75; }

/* 페이지 전체를 감싸는 컨테이너 */
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* 빈 상태 표시 (포스트 없을 때 등) */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
  grid-column: 1 / -1; /* 그리드 전체 너비 차지 */
}
.empty-state .empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.empty-state p { font-size: 1.05rem; }
````


## `css/header.css`

````css
/* =============================================
   css/header.css — 상단 헤더 & 네비게이션
   ============================================= */

.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--header-height);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(10px);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  transition: background var(--transition), border-color var(--transition);
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

/* 블로그 타이틀 */
.site-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-heading);
  letter-spacing: -0.02em;
  flex-shrink: 0;
  text-decoration: none;
}
.site-title span { color: var(--accent); }

/* 헤더 우측 컨트롤 묶음 */
.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* ══════════════════════════════════════════
   공통 헤더 컨트롤 버튼 (필 스타일)
   글쓰기(.theme-toggle<a>), 색상(.color-picker-wrap), 다크(.theme-toggle<button>)
   세 가지가 모두 동일한 height: 32px 필 모양을 갖습니다.
   ══════════════════════════════════════════ */

/* ─ 글쓰기 & 다크 버튼 (공통) ─ */
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 32px;
  padding: 0 0.85rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-family: var(--font);
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;  /* <a> 태그용 */
  cursor: pointer;
  flex-shrink: 0;
  /* 브라우저 button 기본 스타일 제거 */
  -webkit-appearance: none;
  appearance: none;
  transition: border-color var(--transition), color var(--transition),
              background var(--transition);
}
.theme-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}

/* ── 색상 프리셋 래퍼 (버튼 + 팝업을 감싸는 컨테이너) ── */
.color-preset-wrap {
  position: relative;
  flex-shrink: 0;
}

/* 현재 색상을 나타내는 원형 점 */
.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent); /* CSS 변수 직접 참조 → 색 바뀌면 자동 반영 */
  flex-shrink: 0;
  border: 1.5px solid rgba(0,0,0,0.12);
  transition: background var(--transition);
}
body.dark .color-dot { border-color: rgba(255,255,255,0.15); }

/* ── 프리셋 팝업 (버튼 클릭 시 버튼 아래에 표시) ── */
.color-preset-popup {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 200;

  display: none; /* 기본 숨김, .open 클래스로 표시 */
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px;

  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.14);
  min-width: 144px;
}
.color-preset-popup.open { display: grid; }

/* 개별 색상 스와치 버튼 */
.preset-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2.5px solid transparent;
  cursor: pointer;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.preset-swatch:hover { transform: scale(1.18); }

/* 현재 선택된 스와치: 흰 내부 테두리 + 외곽 링 */
.preset-swatch.active {
  border-color: #fff;
  box-shadow: 0 0 0 2.5px var(--accent);
  transform: scale(1.1);
}
````


## `css/sidebar.css`

````css
/* =============================================
   css/sidebar.css — 왼쪽 카테고리 사이드바

   ★ 레이아웃 통일 원칙 ★
   index.html(.index-layout)과 post.html(.post-page-outer) 양쪽 모두
   동일한 변수(--sidebar-left, --layout-padding)를 사용합니다.
   이를 지키지 않으면 페이지 이동 시 사이드바 위치가 흔들립니다.
   ============================================= */

/* ══════════════════════════════════════════════
   index.html 2열 레이아웃
   (사이드바 | 포스트 목록)
   ══════════════════════════════════════════════ */
.index-layout {
  display: grid;
  grid-template-columns: var(--sidebar-left) 1fr; /* ← variables.css의 --sidebar-left 사용 */
  gap: 1.5rem;
  align-items: start;
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--layout-padding); /* ← 양쪽 동일한 패딩 사용 */
}

/* ══════════════════════════════════════════════
   사이드바 공통 (index + post 동일)
   ══════════════════════════════════════════════ */
.category-sidebar {
  position: sticky;
  top: calc(var(--header-height) + 1rem);
  /* 명시적 height 필수: flex 자식의 flex:1이 동작하려면 부모 height가 정의돼야 함 */
  height: calc(100vh - var(--header-height) - 2rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 0;
}

/* 섹션 공통 */
.sidebar-section {
  flex-shrink: 0;
}
.sidebar-section + .sidebar-section {
  border-top: 1px solid var(--border);
}

/* ── 상단: 검색 + 카테고리 (스크롤 가능) ── */
.sidebar-section--top {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0.75rem;
}
.sidebar-section--top .category-tree-wrap {
  flex: 1;
  min-height: 0;
}
/* sidebar.js가 동적으로 .category-tree-wrap을 삽입하므로
   tree 자체도 flex로 채우도록 */
.sidebar-section--top > .category-tree {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ── 중단: 미니 그래프 (고정 높이) ── */
.sidebar-section--mid {
  flex: 0 0 auto;
  padding: 0.6rem 0;
}

.mini-graph-container {
  position: relative;
  height: 185px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
#miniGraphSvg {
  width: 100%;
  height: 100%;
  display: block;
}
.mini-graph-tooltip {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.72rem;
  color: var(--text);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── 하단: 태그 + 태그 검색 (스크롤 가능) ── */
.sidebar-section--bot {
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: 0.6rem;
  max-height: 38%;
}

/* 태그 검색 입력창 */
.tag-search-wrap {
  flex-shrink: 0;
  margin-bottom: 0.45rem;
}
.tag-search-input {
  width: 100%;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  font-family: var(--font);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  outline: none;
  transition: border-color var(--transition);
}
.tag-search-input:focus { border-color: var(--accent); }
.tag-search-input::placeholder { color: var(--text-muted); }

/* 태그 칩 스크롤 영역 */
.tag-chips-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.tag-chips-scroll::-webkit-scrollbar { width: 3px; }
.tag-chips-scroll::-webkit-scrollbar-track { background: transparent; }
.tag-chips-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.sidebar-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

/* ══════════════════════════════════════════════
   카테고리 트리 스크롤 래퍼
   카테고리가 많아지면 이 영역만 독립적으로 스크롤됩니다.
   검색바, 태그, 레이블 등은 스크롤 밖에 고정됩니다.
   ══════════════════════════════════════════════ */
.category-tree-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  margin: 0 -0.25rem;
  padding: 0 0.25rem;
}

/* 스크롤바 스타일 */
.category-tree-wrap::-webkit-scrollbar { width: 4px; }
.category-tree-wrap::-webkit-scrollbar-track { background: transparent; }
.category-tree-wrap::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}
.category-tree-wrap::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}

/* ══════════════════════════════════════════════
   카테고리 트리 항목
   ══════════════════════════════════════════════ */
.category-tree {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* 트리 항목 버튼 */
.tree-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.32rem 0.5rem;
  border-radius: 6px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition);
  border-left: 2px solid transparent;
}
.tree-item:hover {
  background: var(--accent-light);
  color: var(--accent);
}
.tree-item.active {
  background: var(--accent-light);
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 600;
}

/* ▶ 화살표 (펼치기/접기 상태 표시) */
.tree-arrow {
  font-size: 0.6rem;
  transition: transform var(--transition);
  flex-shrink: 0;
  color: var(--text-muted);
  width: 10px;
}
.tree-node.open > .tree-item .tree-arrow {
  transform: rotate(90deg);
}

/* 카테고리 이름 */
.tree-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 포스트 수 배지 */
.tree-count {
  font-size: 0.72rem;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  flex-shrink: 0;
  transition: all var(--transition);
}
.tree-item.active .tree-count,
.tree-item:hover .tree-count {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* 하위 트리 (자식 ul) */
.tree-children {
  list-style: none;
  margin-left: 0.6rem;
  padding-left: 0.75rem;
  border-left: 1px solid var(--border);
  display: none;
  flex-direction: column;
  gap: 1px;
}
.tree-node.open > .tree-children {
  display: flex;
}

/* 전체 보기 항목 */
.tree-item-all {
  margin-bottom: 0.3rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3rem;
}

/* ══════════════════════════════════════════════
   모바일 토글 버튼
   ══════════════════════════════════════════════ */
.sidebar-toggle {
  display: none;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-family: var(--font);
  cursor: pointer;
  width: 100%;
  transition: all var(--transition);
}
.sidebar-toggle:hover { border-color: var(--accent); color: var(--accent); }

/* ══════════════════════════════════════════════
   사이드바 내부 컨텐츠 래퍼
   (데스크탑: 항상 보임 / 모바일: 토글로 열림)
   ══════════════════════════════════════════════ */
.sidebar-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  gap: 0;
}

/* ══════════════════════════════════════════════
   반응형
   ══════════════════════════════════════════════ */
@media (max-width: 900px) {
  .index-layout {
    grid-template-columns: 1fr;
    padding: 1rem;
    gap: 0;
  }

  .category-sidebar {
    position: static;
  }

  .sidebar-content {
    display: none; /* 기본 숨김 */
    margin-top: 0.5rem;
    padding: 1rem;
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  .sidebar-content.open { display: flex; }

  .sidebar-toggle { display: flex; }

  /* 모바일에서 사이드바 높이 제한 해제 */
  .category-sidebar { max-height: none; }
}
````


## `css/cards.css`

````css
/* =============================================
   css/cards.css — 포스트 카드 & 그리드

   메인 페이지의 포스트 목록 카드 스타일입니다.
   카드에 이미지 썸네일 등을 추가하려면
   이 파일을 수정하세요.
   ============================================= */

/* 카드들이 배치되는 그리드 컨테이너 */
.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}

/* 개별 포스트 카드 */
.post-card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  cursor: pointer;
}
.post-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
  border-color: var(--accent);
  opacity: 1; /* a:hover의 opacity 오버라이드 */
}

/* 카테고리 배지 */
.post-category {
  align-self: flex-start;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  background: var(--accent-light);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
}

/* 카드 제목 */
.post-card-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-heading);
  line-height: 1.4;
  letter-spacing: -0.02em;
}

/* 요약 (최대 3줄) */
.post-card-excerpt {
  font-size: 0.88rem;
  color: var(--text-muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1; /* 가변 영역을 채워서 날짜/태그를 카드 하단에 고정 */
}

/* 카드 하단 메타 (날짜 + 태그) */
.post-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: auto;
}

.post-date {
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* 태그 목록 */
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.post-tag {
  font-size: 0.72rem;
  color: var(--text-muted);
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 0.12rem 0.5rem;
  border-radius: 4px;
}
````


## `css/filters.css`

````css
/* =============================================
   css/filters.css — 카테고리/태그 필터 칩

   검색 기능 추가 시 이 파일에 .search-bar
   같은 클래스를 추가하면 됩니다.
   ============================================= */

.filter-section {
  margin-bottom: 1.5rem;
}

.filter-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

/* 칩들이 가로로 나열되는 컨테이너 */
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

/* 개별 칩 버튼 */
.chip {
  padding: 0.28rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 0.8rem;
  font-family: var(--font);
  cursor: pointer;
  transition: all var(--transition);
  line-height: 1.5;
}
.chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* 선택된 칩 */
.chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* ── 목록 툴바 (검색결과 + 정렬) ── */
.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 1.2rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-result-info {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0;
}

.sort-bar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.2rem 0.4rem;
}

.sort-label {
  font-size: 0.73rem;
  color: var(--text-muted);
  padding: 0 0.3rem;
  white-space: nowrap;
}

.sort-btn {
  padding: 0.22rem 0.75rem;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-family: var(--font);
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}
.sort-btn:hover {
  color: var(--accent);
}
.sort-btn.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
````


## `css/search.css`

````css
/* =============================================
   css/search.css — 검색 기능 스타일

   구조:
   .search-wrap        (검색바 전체 래퍼)
     ├── .search-icon  (돋보기 아이콘)
     ├── #searchInput  (텍스트 입력)
     └── #searchClear  (X 지우기 버튼)

   .search-result-info (결과 수 표시 텍스트)
   mark                (검색어 하이라이트)
   ============================================= */

/* ── 검색바 컨테이너 ── */
.search-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color var(--transition), box-shadow var(--transition);
  margin-bottom: 1.25rem;
}

/* 포커스 시 액센트 컬러 테두리 */
.search-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

/* 돋보기 아이콘 */
.search-icon {
  color: var(--text-muted);
  font-size: 0.95rem;
  flex-shrink: 0;
  transition: color var(--transition);
}
.search-wrap:focus-within .search-icon {
  color: var(--accent);
}

/* 텍스트 입력 필드 */
.search-input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  font-size: 0.95rem;
  font-family: var(--font);
  color: var(--text);
  line-height: 1.5;
  min-width: 0;
}
.search-input::placeholder { color: var(--text-muted); }

/* X 지우기 버튼 */
.search-clear {
  display: none;          /* 기본 숨김, 입력 시 JS로 보임 */
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: var(--text-muted);
  color: var(--bg);
  font-size: 0.7rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition);
  line-height: 1;
}
.search-clear:hover { background: var(--accent); }

/* ── 결과 수 표시 ── */
.search-result-info {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
  min-height: 1.2em; /* 없을 때도 높이 유지해서 레이아웃 흔들림 방지 */
}
.search-result-info strong {
  color: var(--accent);
  font-weight: 600;
}

/* ── 검색어 하이라이트 (카드 제목/요약에서 매칭된 부분) ── */
mark {
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 3px;
  padding: 0.05em 0.2em;
  font-weight: 600;
  /* 브라우저 기본 mark 스타일 제거 */
  text-decoration: none;
}

/* 다크 모드에서 mark */
body.dark mark {
  background: var(--accent-light);
  color: var(--accent);
}
````


## `css/post.css`

````css
/* =============================================
   css/post.css — 포스트 상세 페이지 & 마크다운

   글 본문 스타일과 상세 페이지 레이아웃입니다.
   ============================================= */

/* ══════════════════════════════════════════
   post.html 3열 레이아웃 외부 컨테이너
   사이드바 | 본문+ToC 영역

   ★ index.html(.index-layout)과 동일한 변수 사용 ★
   너비(--sidebar-left), 패딩(--layout-padding)이 달라지면
   페이지 이동 시 사이드바 위치가 흔들립니다.
   ══════════════════════════════════════════ */
.post-page-outer {
  display: grid;
  grid-template-columns: var(--sidebar-left) 1fr; /* index와 동일 */
  gap: 1.5rem;                                      /* index와 동일 */
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--layout-padding);                   /* index와 동일 */
  align-items: start;
}

/* 오른쪽 영역: 뒤로가기 버튼 + 2열(본문+ToC) */
.post-content-area {
  min-width: 0; /* grid overflow 방지 */
}

/* ── 2열 레이아웃: 본문(왼쪽) + ToC(오른쪽) ── */
.post-layout {
  display: grid;
  grid-template-columns: 1fr var(--sidebar-width);
  gap: 3rem;
  align-items: start;
}
/* grid child가 넘치지 않도록 */
.post-layout > * { min-width: 0; }

/* 뒤로가기 버튼 */
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 2rem;
  transition: color var(--transition);
}
.back-btn:hover { color: var(--accent); opacity: 1; }

/* 포스트 헤더 (제목, 날짜, 카테고리) */
.post-header {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}
.post-header h1 {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-heading);
  line-height: 1.3;
  letter-spacing: -0.03em;
  margin: 0.6rem 0 0.75rem;
}

/* ── 마크다운 본문 ── */
.post-body {
  font-size: 1rem;
  line-height: 1.85;
  color: var(--text);
}

/* 제목 공통 */
.post-body h1,
.post-body h2,
.post-body h3,
.post-body h4 {
  color: var(--text-heading);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.4;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
  /* sticky 헤더에 가리지 않도록 위쪽 여백 */
  scroll-margin-top: calc(var(--header-height) + 16px);
}
.post-body h1 { font-size: 1.8rem; }
.post-body h2 {
  font-size: 1.4rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}
.post-body h3 { font-size: 1.15rem; }
.post-body h4 { font-size: 1rem; }

/* 문단 */
.post-body p { margin-bottom: 1.25rem; }

/* 인라인 코드 */
.post-body code {
  font-family: var(--font-code);
  font-size: 0.875em;
  background: var(--bg-code);
  border: 1px solid var(--border);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  color: var(--accent);
}

/* 코드 블록 */
.post-body pre {
  background: var(--bg-code);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  overflow-x: auto;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}
.post-body pre code {
  background: none;
  border: none;
  padding: 0;
  color: var(--text);
  font-size: 0.875rem;
}

/* 인용문 */
.post-body blockquote {
  border-left: 3px solid var(--accent);
  padding: 0.75rem 1.25rem;
  margin: 1.5rem 0;
  background: var(--accent-light);
  border-radius: 0 8px 8px 0;
  color: var(--text-muted);
  font-style: italic;
}

/* 구분선 */
.post-body hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2rem 0;
}

/* 목록 */
.post-body ul,
.post-body ol {
  padding-left: 1.5rem;
  margin-bottom: 1.25rem;
}
.post-body li { margin-bottom: 0.35rem; }

/* 이미지 */
.post-body img {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border);
}

/* 링크 */
.post-body a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* 표 — 가로 스크롤 지원 (모든 화면 크기) */
.post-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  display: block;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.post-body th,
.post-body td {
  padding: 0.6rem 1rem;
  border: 1px solid var(--border);
  text-align: left;
}
.post-body th {
  background: var(--bg-card);
  font-weight: 600;
  color: var(--text-heading);
}

/* 인라인 코드 — 긴 코드가 화면 밖으로 삐져나가지 않도록 */
.post-body code {
  word-break: break-all;
}

/* pre 안의 code는 줄바꿈 그대로 유지 */
.post-body pre code {
  word-break: normal;
}
````


## `css/toc.css`

````css
/* =============================================
   css/toc.css — 오른쪽 목차 (Table of Contents)

   스크롤 시 따라오고, 현재 섹션을 하이라이트합니다.
   ============================================= */

.toc-sidebar {
  position: sticky;
  top: calc(var(--header-height) + 1.5rem); /* 헤더 아래에서 시작 */
  max-height: calc(100vh - var(--header-height) - 3rem);
  overflow-y: auto;
  font-size: 0.82rem;
}

/* 스크롤바 커스텀 */
.toc-sidebar::-webkit-scrollbar { width: 4px; }
.toc-sidebar::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.toc-title {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  padding-bottom: 0.5rem;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid var(--border);
}

/* 목차 항목 목록 */
.toc-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

/* 개별 목차 링크 */
.toc-item a {
  display: block;
  padding: 0.28rem 0.5rem;
  border-radius: 4px;
  color: var(--text-muted);
  text-decoration: none;
  line-height: 1.45;
  border-left: 2px solid transparent;
  transition: all var(--transition);
}
.toc-item a:hover {
  color: var(--accent);
  background: var(--accent-light);
  opacity: 1;
}

/* 현재 보고 있는 섹션 강조 */
.toc-item a.active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: var(--accent-light);
  font-weight: 600;
}

/* 들여쓰기: h2 → h3 → h4 순으로 깊어짐 */
.toc-item.level-2 a { padding-left: 0.5rem; }
.toc-item.level-3 a { padding-left: 1.25rem; font-size: 0.78rem; }
.toc-item.level-4 a { padding-left: 2rem;   font-size: 0.75rem; }
````


## `css/code.css`

````css
/**
 * css/code.css — 코드 블록 하이라이팅(노션 스타일) + 헤더 토글
 *
 * highlight.js 토큰 색을 사이트 테마(라이트/다크)에 맞춰 CSS 변수로 정의합니다.
 * highlight.js의 자체 테마 CSS는 불러오지 않습니다 (여기서 직접 색을 지정).
 */

/* ── 토큰 색 팔레트: 라이트(기본) ── */
:root {
  --hl-comment: #6a737d;
  --hl-keyword: #d73a49;
  --hl-string:  #032f62;
  --hl-number:  #005cc5;
  --hl-title:   #6f42c1;  /* 함수/클래스명 */
  --hl-builtin: #e36209;  /* 내장/타입 */
  --hl-attr:    #005cc5;  /* 속성/변수 */
  --hl-tag:     #22863a;  /* 태그 */
  --hl-meta:    #6a737d;
}

/* ── 토큰 색 팔레트: 다크 ── */
:root.dark {
  --hl-comment: #8b949e;
  --hl-keyword: #ff7b72;
  --hl-string:  #a5d6ff;
  --hl-number:  #79c0ff;
  --hl-title:   #d2a8ff;
  --hl-builtin: #ffa657;
  --hl-attr:    #79c0ff;
  --hl-tag:     #7ee787;
  --hl-meta:    #8b949e;
}

/* ══════════════════════════════════════════════════
   코드 블록 컨테이너 (노션식: 헤더바 + 코드)
   ══════════════════════════════════════════════════ */
.post-body .code-block {
  margin-bottom: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-code);
}

/* 헤더바: 언어 라벨 + 복사 버튼 */
.post-body .code-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  font-size: 0.72rem;
}
.post-body .code-lang {
  font-family: var(--font-code);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.post-body .code-copy {
  font-size: 0.72rem;
  font-family: inherit;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0.15rem 0.55rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.post-body .code-copy:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.post-body .code-copy.copied {
  color: #16a34a;
  border-color: #16a34a;
}

/* 컨테이너 안의 pre는 테두리/여백 제거 (컨테이너가 담당) */
.post-body .code-block pre {
  border: none;
  border-radius: 0;
  margin: 0;
  background: transparent;
}

/* highlight.js 처리된 code: 기본 텍스트 색 */
.post-body pre code.hljs {
  color: var(--text);
  background: transparent;
  padding: 0;
}

/* ── highlight.js 토큰 → 테마 변수 매핑 ── */
.hljs-comment,
.hljs-quote            { color: var(--hl-comment); font-style: italic; }

.hljs-keyword,
.hljs-selector-tag,
.hljs-literal,
.hljs-doctag,
.hljs-name             { color: var(--hl-keyword); }

.hljs-string,
.hljs-regexp,
.hljs-addition         { color: var(--hl-string); }

.hljs-number,
.hljs-symbol,
.hljs-bullet           { color: var(--hl-number); }

.hljs-title,
.hljs-title.function_,
.hljs-section          { color: var(--hl-title); }

.hljs-built_in,
.hljs-type,
.hljs-class .hljs-title,
.hljs-title.class_     { color: var(--hl-builtin); }

.hljs-attr,
.hljs-attribute,
.hljs-variable,
.hljs-template-variable,
.hljs-property         { color: var(--hl-attr); }

.hljs-tag,
.hljs-selector-id,
.hljs-selector-class   { color: var(--hl-tag); }

.hljs-meta,
.hljs-comment.hljs-doctag { color: var(--hl-meta); }

.hljs-emphasis         { font-style: italic; }
.hljs-strong           { font-weight: 700; }

/* ══════════════════════════════════════════════════
   헤더 토글 (접기/펼치기)
   ══════════════════════════════════════════════════ */
.post-body .toggle-header {
  cursor: pointer;
  user-select: none;
}
/* 왼쪽 셰브론 — 헤더 텍스트 앞에 인라인으로 붙음 */
.post-body .toggle-header::before {
  content: '▾';
  display: inline-block;
  width: 0.9em;
  margin-right: 0.35em;
  color: var(--text-muted);
  font-size: 0.8em;
  transition: transform 0.15s ease;
}
/* 접힌 상태: 셰브론 회전 */
.post-body .toggle-header.collapsed::before {
  transform: rotate(-90deg);
}
.post-body .toggle-header:hover::before {
  color: var(--accent);
}

/* 접힌 내용 숨김 */
.post-body .toggle-content.collapsed {
  display: none;
}
````


## `css/graph.css`

````css
/* ════════════════════════════════════════════════════════
   css/graph.css — 연결 그래프 오버레이 스타일
   ════════════════════════════════════════════════════════ */

/* ── CSS 변수 ── */
:root {
  --graph-post:     #94a3b8;
  --graph-cat:      var(--accent);
  --graph-link-cat: var(--border);
  --graph-bg:       var(--bg);
  --graph-label:    var(--text-muted);
}
:root.dark {
  --graph-post:  #64748b;
  --graph-label: rgba(255,255,255,0.55);
}

/* ════════════════════════════════════
   오버레이 전체
   ════════════════════════════════════ */
#graphOverlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: var(--graph-bg);
  display: flex;
  flex-direction: column;

  /* 숨김 상태 */
  opacity: 0;
  pointer-events: none;
  transform: scale(0.98);
  transition: opacity 0.22s ease, transform 0.22s ease;
}

#graphOverlay.open {
  opacity: 1;
  pointer-events: all;
  transform: scale(1);
}

/* ════════════════════════════════════
   상단 바
   ════════════════════════════════════ */
.graph-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  backdrop-filter: blur(8px);
}

.graph-topbar-left,
.graph-topbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.graph-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text);
  white-space: nowrap;
}

/* 범례 */
.graph-legend {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.76rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.legend-item svg {
  flex-shrink: 0;
}

/* 힌트 텍스트 */
.graph-hint {
  font-size: 0.74rem;
  color: var(--text-muted);
  white-space: nowrap;
  opacity: 0.7;
}

/* 닫기 버튼 */
.graph-close-btn {
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 50%;
  background: var(--border);
  color: var(--text);
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}
.graph-close-btn:hover {
  background: var(--accent);
  color: #fff;
}

/* ════════════════════════════════════
   캔버스 영역
   ════════════════════════════════════ */
.graph-canvas-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
}

#graphSvg {
  width: 100%;
  height: 100%;
  display: block;
}

/* ════════════════════════════════════
   SVG 내부 요소 (D3)
   ════════════════════════════════════ */

/* 링크 선 */
.graph-link {
  fill: none;
  stroke-linecap: round;
}
.graph-link-cat {
  stroke: var(--graph-link-cat);
  stroke-width: 1.2px;
}

/* 노드 공통 */
.g-node { transition: opacity 0.2s; }
.g-node:hover .node-label { opacity: 1; }

/* 포스트 노드 원 */
.g-node-post .node-shape {
  fill: var(--graph-post);
  transition: fill 0.2s, r 0.3s;
}
.g-node-post:hover .node-shape {
  fill: var(--accent);
}

/* 현재 포스트 */
.g-node-current .node-shape {
  fill: var(--accent) !important;
  filter: drop-shadow(0 0 6px var(--accent));
}

/* 글로우 링 (현재 포스트) */
.node-glow {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.5px;
  opacity: 0;
  animation: graph-glow 2.4s ease-in-out infinite;
}
@keyframes graph-glow {
  0%,100% { opacity: 0.2; stroke-width: 2.5px; }
  50%      { opacity: 0.7; stroke-width: 4px;   }
}

/* 카테고리 노드 사각형 */
.g-node-category .node-shape {
  fill: var(--accent-light);
  stroke: var(--accent);
  stroke-width: 2px;
}
.g-node-category:hover .node-shape {
  fill: var(--accent);
}


/* 라벨 */
.node-label {
  font-size: 10px;
  fill: var(--graph-label);
  pointer-events: none;
  user-select: none;
  font-family: inherit;
  transition: opacity 0.2s;
}

.g-node-category .node-label {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text);
}

.g-node-current .node-label {
  font-size: 12px;
  font-weight: 700;
  fill: var(--accent);
}

/* ════════════════════════════════════
   툴팁
   ════════════════════════════════════ */
.graph-tooltip {
  position: fixed;
  display: none;
  background: var(--text);
  color: var(--bg);
  font-size: 0.78rem;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ════════════════════════════════════
   헤더 버튼 활성 상태
   ════════════════════════════════════ */
#graphBtn.active {
  background: var(--accent-light);
  color: var(--accent);
}

/* ════════════════════════════════════
   반응형: 모바일에서 힌트 숨김
   ════════════════════════════════════ */
@media (max-width: 640px) {
  .graph-hint { display: none; }
  .graph-legend { display: none; }
  .graph-topbar { padding: 0.6rem 1rem; }
  #graphBtn span:last-child { display: none; }
}
````


## `css/music-player.css`

````css
/* =============================================
   css/music-player.css — 하단 고정 뮤직 플레이어

   구조:
   .music-player
     ├── .playlist-panel   (위로 슬라이드되는 플레이리스트)
     └── .player-bar       (항상 보이는 하단 바)
           ├── .player-track    (앨범 커버 + 곡명/아티스트)
           ├── .player-center   (재생 버튼 + 프로그레스 바)
           └── .player-extra    (셔플/반복/볼륨/목록)
   ============================================= */

/* ── body 하단 여백 ──
   music-player.css가 로드되는 순간 바로 적용됩니다.
   JS가 실행되기 전에 미리 패딩을 잡아두어
   플레이어가 나타날 때 레이아웃이 흔들리지 않습니다. */
body {
  padding-bottom: 68px;
}

/* ── 전체 컨테이너 ── */
.music-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 500;
  font-family: var(--font);
}

/* body.has-player: JS가 붙이는 클래스 (현재는 CSS의 body 패딩으로 대체되어 필요 없지만 하위호환성 유지) */
body.has-player { padding-bottom: 68px; }

/* ══════════════════════════════════════════════
   플레이리스트 패널 (위로 슬라이드)
   ══════════════════════════════════════════════ */
.playlist-panel {
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  max-height: 0;                    /* 닫힌 상태: 높이 0 */
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.playlist-panel.open {
  max-height: 320px;                /* 열린 상태: 최대 320px */
}

.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.playlist-header button {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.2rem;
  border-radius: 4px;
  transition: color var(--transition);
}
.playlist-header button:hover { color: var(--accent); }

/* 곡 목록 스크롤 영역 */
.playlist-items {
  list-style: none;
  overflow-y: auto;
  max-height: 256px;
}
.playlist-items::-webkit-scrollbar { width: 4px; }
.playlist-items::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

/* 개별 곡 항목 */
.playlist-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  transition: background var(--transition);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
}
.playlist-item:hover { background: var(--accent-light); }
.playlist-item.active {
  background: var(--accent-light);
  color: var(--accent);
}

/* 재생 중 표시 (애니메이션 이퀄라이저) */
.playlist-item.active .playlist-num {
  display: none; /* 번호 숨기고 이퀄라이저로 대체 */
}
.playlist-item.active::before {
  content: '♫';
  font-size: 0.85rem;
  color: var(--accent);
  flex-shrink: 0;
  animation: pulse 1s ease-in-out infinite alternate;
}
.playlist-item:not(.active)::before { display: none; }

@keyframes pulse {
  from { opacity: 0.5; }
  to   { opacity: 1; }
}

.playlist-num {
  font-size: 0.78rem;
  color: var(--text-muted);
  width: 20px;
  text-align: right;
  flex-shrink: 0;
}

.playlist-track-info {
  flex: 1;
  min-width: 0; /* overflow 처리용 */
}
.playlist-track-title {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.playlist-item.active .playlist-track-title { color: var(--accent); }

.playlist-track-artist {
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* ══════════════════════════════════════════════
   플레이어 바 (항상 보이는 하단 영역)
   ══════════════════════════════════════════════ */
.player-bar {
  display: grid;
  /* 트랙정보 | 중앙(재생+프로그레스) | 부가컨트롤 */
  grid-template-columns: 240px 1fr 220px;
  align-items: center;
  gap: 1rem;
  height: 68px;
  padding: 0 1.25rem;
  background: color-mix(in srgb, var(--bg-card) 96%, transparent);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(12px);
  transition: background var(--transition);
}

/* ── 트랙 정보 (왼쪽) ── */
.player-track {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

/* 앨범 커버 / 기본 아이콘 */
.track-cover {
  width: 42px;
  height: 42px;
  border-radius: 6px;
  background: var(--accent-light);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
  overflow: hidden;
}
.track-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.track-info { min-width: 0; }
.track-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-artist {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── 중앙: 재생 컨트롤 + 프로그레스 ── */
.player-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* 컨트롤 버튼 공통 */
.ctrl-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  padding: 0.3rem 0.4rem;
  font-size: 0.9rem;
  line-height: 1;
  transition: all var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ctrl-btn:hover { color: var(--accent); background: var(--accent-light); }

/* 재생/일시정지 버튼 (강조) */
.play-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff !important;
  font-size: 1rem;
}
.play-btn:hover { opacity: 0.85; background: var(--accent) !important; }

/* 활성화된 버튼 (셔플 켜짐, 반복 켜짐) */
.ctrl-btn.on { color: var(--accent); }

/* 프로그레스 바 */
.player-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.time {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 32px;
}
.time:last-child { text-align: right; }

/* range 슬라이더 공통 스타일 */
input[type="range"].progress-slider,
input[type="range"].volume-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  outline: none;
  cursor: pointer;
  flex: 1;
  transition: height var(--transition);
}
input[type="range"].progress-slider:hover { height: 5px; }

/* 채워진 부분 (JS로 --pct 변수 설정) */
input[type="range"].progress-slider,
input[type="range"].volume-slider {
  background: linear-gradient(
    to right,
    var(--accent) 0%,
    var(--accent) var(--pct, 0%),
    var(--border)  var(--pct, 0%),
    var(--border)  100%
  );
}

/* 슬라이더 thumb */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: 2px solid var(--bg);
  box-shadow: 0 0 0 1px var(--accent);
}

/* ── 오른쪽: 부가 컨트롤 ── */
.player-extra {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  justify-content: flex-end;
}

.volume-wrap {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
input[type="range"].volume-slider {
  width: 70px;
  height: 3px;
}
input[type="range"].volume-slider::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
}

/* ── 플레이리스트 없을 때 안내 ── */
.playlist-empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.88rem;
}

/* ══════════════════════════════════════════════
   반응형
   ══════════════════════════════════════════════ */
@media (max-width: 768px) {
  .player-bar {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    height: auto;
    padding: 0.5rem 1rem;
    gap: 0.35rem;
  }

  /* 모바일: 트랙 정보 + 컨트롤 한 줄, 프로그레스 두 번째 줄 */
  .player-track { grid-column: 1; grid-row: 1; }
  .player-center { grid-column: 1 / -1; grid-row: 2; width: 100%; }
  .player-extra  { grid-column: 2; grid-row: 1; }

  /* 볼륨 슬라이더 숨김 (공간 부족) */
  .volume-wrap input { display: none; }
}
````


## `css/editor.css`

````css
/* =============================================
   css/editor.css — 글 작성 에디터 스타일

   좌우 분할 레이아웃:
   왼쪽(에디터) | 오른쪽(미리보기)
   ============================================= */

/* ── 에디터 전체 레이아웃 ── */

/* 에디터 페이지는 헤더 바로 아래부터 화면 전체를 채웁니다 */
.editor-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-height));
}

/* 상단 툴바 (저장 버튼, 파일명 등) */
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
  gap: 1rem;
  flex-shrink: 0; /* 툴바는 높이 고정 */
}

.editor-toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.editor-toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* 파일명 입력 (posts/ 기준 상대 경로) */
.filename-input {
  font-family: var(--font-code);
  font-size: 0.85rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  width: 260px;
  transition: border-color var(--transition);
}
.filename-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* 툴바 버튼 공통 */
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-family: var(--font);
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}
.toolbar-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}

/* 저장 버튼 (강조) */
.toolbar-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.toolbar-btn.primary:hover {
  opacity: 0.88;
  color: #fff;
}

/* 저장 성공 상태 */
.toolbar-btn.saved {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

/* ── 좌우 분할 패널 ── */
.editor-panels {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 정확히 반반 */
  flex: 1;                         /* 남은 높이 모두 차지 */
  overflow: hidden;                /* 각 패널이 독립적으로 스크롤 */
  gap: 0;
}

/* 구분선 */
.editor-panels > * + * {
  border-left: 1px solid var(--border);
}

/* ── 왼쪽: 에디터 패널 ── */
.editor-left {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Front Matter 입력 폼 영역 */
.frontmatter-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
  flex-shrink: 0;
}

/* 폼 전체 너비 차지하는 필드 */
.frontmatter-form .full-width {
  grid-column: 1 / -1;
}

/* 폼 레이블 */
.fm-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  margin-bottom: 0.3rem;
}

/* 폼 입력 공통 스타일 */
.fm-input {
  width: 100%;
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.875rem;
  font-family: var(--font);
  transition: border-color var(--transition);
}
.fm-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* 에디터 툴바 (볼드/이탤릭/코드 등 서식 버튼) */
.editor-format-bar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.fmt-btn {
  padding: 0.25rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-family: var(--font-code);
  cursor: pointer;
  transition: all var(--transition);
  line-height: 1.4;
}
.fmt-btn:hover {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}

/* 서식 버튼 사이 구분선 */
.fmt-divider {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 0.2rem;
}

/* 마크다운 입력 textarea */
.editor-textarea {
  flex: 1;
  resize: none;          /* 드래그 리사이즈 비활성화 */
  border: none;
  outline: none;
  padding: 1.25rem;
  font-family: var(--font-code);
  font-size: 0.9rem;
  line-height: 1.8;
  color: var(--text);
  background: var(--bg);
  overflow-y: auto;
  tab-size: 2;
  transition: background var(--transition), color var(--transition);
}
.editor-textarea::placeholder { color: var(--text-muted); }

/* ── 오른쪽: 미리보기 패널 ── */
.editor-right {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 미리보기 패널 헤더 */
.preview-header {
  padding: 0.5rem 1rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
  flex-shrink: 0;
}

/* 미리보기 본문 (스크롤 가능) */
.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
}

/* 미리보기 포스트 헤더 */
.preview-post-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}
.preview-post-header h1 {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-heading);
  line-height: 1.3;
  letter-spacing: -0.03em;
  margin: 0.5rem 0 0.5rem;
}

/* 빈 미리보기 안내 */
.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  gap: 0.5rem;
}
.preview-empty .icon { font-size: 2.5rem; }

/* ── 저장 성공 토스트 알림 ── */
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%) translateY(100px); /* 처음엔 화면 아래에 숨김 */
  background: var(--text-heading);
  color: var(--bg);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  z-index: 999;
  transition: transform 0.3s ease;
  white-space: nowrap;
}
/* 표시 상태: 위로 올라옴 */
.toast.show { transform: translateX(-50%) translateY(0); }

/* 설정 패널 섹션 구분선 */
.gh-section-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  padding-top: 0.7rem;
  margin-top: 0.2rem;
}

/* ══════════════════════════════════════════
   GitHub 설정 드롭다운 패널
   ══════════════════════════════════════════ */

.gh-settings-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  z-index: 500;
  display: none;
  flex-direction: column;
  gap: 0.6rem;
}

.gh-settings-panel.open { display: flex; }

.gh-settings-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text);
  margin: 0 0 0.2rem;
}

.gh-settings-desc {
  font-size: 0.76rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0 0 0.4rem;
}

.gh-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.3rem;
}

.gh-token-link {
  font-size: 0.73rem;
  color: var(--accent);
  text-decoration: none;
  font-weight: 400;
}
.gh-token-link:hover { text-decoration: underline; }

.gh-input {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.84rem;
  font-family: var(--font-code);
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.gh-input:focus {
  outline: none;
  border-color: var(--accent);
}

.gh-save-btn {
  margin-top: 0.4rem;
  padding: 0.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.gh-save-btn:hover { opacity: 0.85; }

/* ── 반응형: 모바일은 세로 분할 ── */
@media (max-width: 900px) {
  .editor-panels {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  .editor-panels > * + * {
    border-left: none;
    border-top: 1px solid var(--border);
  }
  .frontmatter-form {
    grid-template-columns: 1fr;
  }
  .frontmatter-form .full-width {
    grid-column: 1;
  }
}

/* ══════════════════════════════════════════════════
   에디터 잠금화면 + 세션바 (editor-auth.js)
   ══════════════════════════════════════════════════ */
#authOverlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;            /* JS가 flex로 전환 */
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(6px);
}
.auth-box {
  width: min(92vw, 380px);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.75rem 1.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.auth-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-heading);
  margin-bottom: 0.75rem;
}
.auth-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1rem;
}
.auth-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.6rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.9rem;
}
.auth-input:focus {
  outline: none;
  border-color: var(--accent);
}
.auth-btn {
  width: 100%;
  padding: 0.6rem;
  margin-top: 0.25rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}
.auth-btn:hover { filter: brightness(1.08); }
.auth-link {
  display: inline-block;
  margin-top: 0.75rem;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  text-decoration: underline;
  cursor: pointer;
}
.auth-link:hover { color: var(--accent); }
.auth-error {
  margin-top: 0.75rem;
  padding: 0.5rem 0.6rem;
  background: color-mix(in srgb, #ef4444 12%, transparent);
  border: 1px solid #ef4444;
  border-radius: 6px;
  color: #ef4444;
  font-size: 0.82rem;
}

/* 세션바 (우상단 고정) */
#authSessionBar {
  position: fixed;
  top: 12px;
  right: 14px;
  z-index: 9000;
  display: none;            /* JS가 flex로 전환 */
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.6rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.78rem;
  color: var(--text-muted);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
.auth-remain-wrap { font-variant-numeric: tabular-nums; }
.auth-mini-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.1rem 0.5rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
}
.auth-mini-btn:hover { color: var(--accent); border-color: var(--accent); }


/* 삭제(위험) 버튼 */
.toolbar-btn.danger {
  color: #ef4444;
  border-color: color-mix(in srgb, #ef4444 45%, var(--border));
}
.toolbar-btn.danger:hover {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  border-color: #ef4444;
}
````


## `css/responsive.css`

````css
/* =============================================
   css/responsive.css — 반응형 미디어 쿼리

   화면 크기별 레이아웃 조정을 모아뒀습니다.
   새 모듈의 반응형 스타일도 여기에 추가하세요.

   브레이크포인트:
   1100px — 포스트 페이지 우측 ToC 사이드바 숨김
    900px — 인덱스 왼쪽 카테고리 사이드바 토글로 전환 (sidebar.css에서 처리)
    768px — 모바일: 전반적인 레이아웃 1열, 폰트 축소
    480px — 소형 폰: 헤더 라벨 숨김, 뮤직플레이어 더 compact
   ============================================= */

/* ── 태블릿 (1100px 이하) — post.html ToC 숨김 ── */
@media (max-width: 1100px) {
  .post-page-outer {
    grid-template-columns: 1fr;
    padding: 1.5rem;
  }
  .post-page-outer .category-sidebar { display: none; }

  /* ToC 너비 축소 */
  :root { --sidebar-width: 200px; }
  .post-layout { gap: 2rem; }
}

/* ── 태블릿 (900px 이하) — ToC도 숨김 ── */
@media (max-width: 900px) {
  .post-layout {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .toc-sidebar { display: none; }
}

/* ── 모바일 (768px 이하) ── */
@media (max-width: 768px) {

  /* ─ 전역 ─ */
  .page-container { padding: 1rem; }
  .post-page-outer { padding: 1rem; }

  /* ─ 헤더 ─ */
  .header-inner { padding: 0 1rem; gap: 0.5rem; }

  /* 글쓰기 버튼 텍스트 숨기고 아이콘만 */
  #themeLabel { display: none; }

  /* 색상 선택 텍스트 숨김 */
  .color-picker-wrap span { display: none; }

  /* ─ 카드 그리드 ─ */
  /* auto-fill이 이미 반응형이지만 minmax 최솟값을 낮춤 */
  .posts-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  /* ─ 필터 툴바 ─ */
  .list-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .sort-bar { width: 100%; justify-content: center; }
  .sort-label { display: none; } /* "정렬:" 레이블 숨김 */
  .sort-btn { flex: 1; text-align: center; }

  /* 태그 칩 줄바꿈 허용 (이미 flex-wrap이지만 패딩 줄임) */
  .chip { padding: 0.22rem 0.7rem; font-size: 0.78rem; }

  /* ─ 포스트 상세 페이지 ─ */
  .post-header h1 { font-size: 1.5rem; }
  .post-body h2   { font-size: 1.2rem; }
  .post-body h3   { font-size: 1.05rem; }
  .post-body      { font-size: 0.95rem; }

  /* 코드 블록 — 좌우 패딩 줄임 */
  .post-body pre {
    padding: 1rem;
    font-size: 0.8rem;
  }

  /* 뒤로가기 버튼 위 여백 줄임 */
  .back-btn { margin-bottom: 1rem; }
  .post-header { margin-bottom: 1.5rem; padding-bottom: 1rem; }

  /* ─ 뮤직 플레이어 (이미 768px 처리되지만 보강) ─ */
  /* player-center의 controls와 progress 모두 full width */
  .player-center { padding: 0 0.25rem; }
  .player-controls { gap: 0.75rem; }
}

/* ── 소형 폰 (480px 이하) ── */
@media (max-width: 480px) {

  /* ─ 헤더 ─ */
  .header-inner { padding: 0 0.75rem; gap: 0.35rem; }
  .site-title { font-size: 1.05rem; }

  /* 헤더 다크 버튼 텍스트 숨기고 아이콘만 표시 */
  #themeLabel { display: none; }
  .theme-toggle { padding: 0 0.6rem; }

  /* 색상 선택 버튼도 더 좁게 */
  .color-preset-wrap .theme-toggle { padding: 0 0.55rem; }

  /* ─ 전역 ─ */
  .page-container { padding: 0.75rem; }
  .post-page-outer { padding: 0.75rem; }

  /* ─ 카드 ─ */
  .post-card { padding: 1.1rem; }
  .post-card-title { font-size: 1rem; }

  /* ─ 포스트 상세 ─ */
  .post-header h1 { font-size: 1.3rem; }
  .post-body      { font-size: 0.92rem; line-height: 1.75; }
  .post-body pre  { font-size: 0.76rem; padding: 0.85rem; }

  /* ─ 필터 ─ */
  .filter-section { margin-bottom: 1rem; }

  /* ─ 뮤직 플레이어 ─ */
  /* 트랙 정보 영역 축소 */
  .track-cover { width: 34px; height: 34px; font-size: 1rem; }
  .track-title { font-size: 0.82rem; }
  .track-artist { font-size: 0.7rem; }

  /* 이전/다음 버튼 숨김으로 공간 확보 */
  #mpPrevBtn, #mpNextBtn { display: none; }

  /* 볼륨/셔플/반복 아이콘 더 작게 */
  .ctrl-btn { padding: 0.2rem 0.3rem; font-size: 0.85rem; }
  .play-btn { width: 34px; height: 34px; font-size: 0.95rem; }

  /* 플레이리스트 패널 높이 제한 */
  .playlist-panel.open { max-height: 240px; }

  /* ─ 검색바 ─ */
  .search-wrap { padding: 0.45rem 0.75rem; }

  /* ─ 사이드바 토글 ─ */
  .sidebar-toggle { font-size: 0.8rem; padding: 0.4rem 0.85rem; }
}
````

