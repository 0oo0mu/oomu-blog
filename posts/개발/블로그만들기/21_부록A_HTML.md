---
title: [블로그 만들기] 부록 A. HTML 3종 + 진입점 스크립트
date: 2026-07-14
category: 개발/블로그만들기
tags: [블로그만들기, 부록, HTML, 전체코드]
excerpt: index.html, post.html, editor.html 세 페이지의 전체 HTML과, 각 페이지를 조립하는 진입점 스크립트(app-index/app-post/app-editor)의 전체 코드입니다.
---

# 부록 A — HTML 3종 + 진입점 스크립트

index.html, post.html, editor.html 세 페이지의 전체 HTML과, 각 페이지를 조립하는 진입점 스크립트(app-index/app-post/app-editor)의 전체 코드입니다.

> 이 부록은 **실제 파일의 완전한 코드**입니다. 각 파일이 왜 그렇게 동작하는지는 해당 본편(00~20)에서 설명했고, 여기서는 그대로 옮겨 적을 수 있도록 전체를 싣습니다. 파일 경로 그대로 만들어 붙여넣으면 됩니다.

## `index.html`

````html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Blog</title>
  <!-- 섬광 방지: CSS 로드 전에 다크모드 + 프리셋 컬러 즉시 적용 -->
  <script>
    (function () {
      var P=[{a:'#6366f1',l:'rgba(99,102,241,0.13)'},{a:'#3b82f6',l:'rgba(59,130,246,0.13)'},{a:'#10b981',l:'rgba(16,185,129,0.13)'},{a:'#06b6d4',l:'rgba(6,182,212,0.13)'},{a:'#8b5cf6',l:'rgba(139,92,246,0.13)'},{a:'#ec4899',l:'rgba(236,72,153,0.13)'},{a:'#f43f5e',l:'rgba(244,63,94,0.13)'},{a:'#f97316',l:'rgba(249,115,22,0.13)'}];
      try {
        if (JSON.parse(localStorage.getItem('theme'))==='dark') document.documentElement.classList.add('dark');
        var i=parseInt(localStorage.getItem('accent_preset'),10), p=P[isNaN(i)?0:Math.min(Math.max(i,0),P.length-1)];
        document.documentElement.style.setProperty('--accent',p.a);
        document.documentElement.style.setProperty('--accent-light',p.l);
      } catch(e) {}
    })();
  </script>

  <meta name="description" content="개발과 일상을 기록하는 블로그" />
  <meta name="author" content="" />
  <meta property="og:type"        content="website" />
  <meta property="og:title"       content="My Blog" />
  <meta property="og:description" content="개발과 일상을 기록하는 블로그" />
  <meta property="og:url"         content="" />
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="My Blog" />
  <meta name="twitter:description" content="개발과 일상을 기록하는 블로그" />

  <!-- CSS: 목록 + 포스트 뷰 모두 포함 (SPA이므로 둘 다 필요) -->
  <link rel="stylesheet" href="css/variables.css" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/header.css" />
  <link rel="stylesheet" href="css/filters.css" />
  <link rel="stylesheet" href="css/cards.css" />
  <link rel="stylesheet" href="css/sidebar.css" />
  <link rel="stylesheet" href="css/search.css" />
  <link rel="stylesheet" href="css/post.css" />     <!-- 포스트 뷰용 -->
  <link rel="stylesheet" href="css/code.css" />     <!-- 코드 하이라이팅 + 헤더 토글 -->
  <link rel="stylesheet" href="css/toc.css" />      <!-- ToC용 -->
  <link rel="stylesheet" href="css/responsive.css" />
  <link rel="stylesheet" href="css/music-player.css" />
  <link rel="stylesheet" href="css/graph.css" />

  <!-- marked.js: 포스트 뷰에서 마크다운 렌더링에 사용 -->
  <script src="https://cdn.jsdelivr.net/npm/marked@9/marked.min.js"></script>
  <!-- highlight.js: 코드 블록 문법 하이라이팅 (색은 css/code.css에서 지정) -->
  <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js"></script>

  <!-- 뷰 전환 스타일 -->
  <style>
    /* SPA 뷰 전환: view-hidden 클래스로 표시/숨김 */
    .view-hidden { display: none !important; }

    /* 포스트 뷰 레이아웃: 본문(1fr) + ToC(240px) */
    #postView {
      display: grid;
      grid-template-columns: 1fr var(--sidebar-width);
      gap: 3rem;
      align-items: start;
    }
    /* postView 숨겨질 때는 grid 해제 */
    #postView.view-hidden { display: none !important; }

    /* grid child가 코드블록/테이블로 인해 overflow되지 않도록 */
    #postView > * { min-width: 0; }

    /* F5 새로고침 시 ?file= 있으면 listView 즉시 숨김 */
    html.is-post-view #listView { display: none !important; }
  </style>
  <!-- F5 새로고침 깜빡임 방지: ?file= 파라미터 감지 즉시 처리 -->
  <script>
    if (location.search.includes('file=')) {
      document.documentElement.classList.add('is-post-view');
    }
  </script>
</head>
<body>

  <!-- 헤더 -->
  <header class="site-header">
    <div class="header-inner">
      <!-- 로고 클릭 → 목록 뷰로 (SPA 라우터가 가로챔) -->
      <a href="index.html" class="site-title" id="siteLogo">My<span>Blog</span></a>
      <div class="header-controls">
        <!-- 글쓰기 버튼 -->
        <a href="editor.html" id="writeBtn" class="theme-toggle">✏️ 글쓰기</a>

        <!-- 색상 프리셋 선택기 -->
        <div class="color-preset-wrap" id="colorPresetWrap">
          <button class="theme-toggle" id="colorPresetBtn" aria-expanded="false" aria-label="테마 색상 변경">
            <span class="color-dot" id="colorDot"></span>
            <span>색상</span>
          </button>
          <!-- JS(accent.js)가 채워주는 스와치 팝업 -->
          <div class="color-preset-popup" id="colorPresetPopup"></div>
        </div>

        <!-- 다크/라이트 토글 버튼 -->
        <button class="theme-toggle" id="themeToggle" aria-label="테마 전환">
          <span id="themeIcon">🌙</span>
          <span id="themeLabel">다크</span>
        </button>
      </div>
    </div>
  </header>

  <!-- ══════════════════════════════════════════
       사이드바 + 메인 2열 레이아웃
       사이드바는 SPA 전환 중에도 유지됩니다.
       ══════════════════════════════════════════ -->
  <div class="index-layout">

    <!-- ── 왼쪽 사이드바 (항상 고정) ── -->
    <aside class="category-sidebar">
      <button class="sidebar-toggle" id="sidebarToggle">
        📂 카테고리
        <span class="toggle-arrow" style="margin-left:auto">▼</span>
      </button>
      <div class="sidebar-content" id="sidebarContent">

        <!-- ── 상단: 검색 + 카테고리 ── -->
        <div class="sidebar-section sidebar-section--top">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" id="searchInput" class="search-input"
              placeholder="검색... (단축키: /)" autocomplete="off" spellcheck="false" />
            <button class="search-clear" id="searchClear" title="지우기">✕</button>
          </div>
          <p class="sidebar-label" style="margin-top:0.75rem">카테고리</p>
          <ul class="category-tree" id="categoryTree">
            <li style="color:var(--text-muted);font-size:0.82rem;padding:.3rem .5rem">불러오는 중...</li>
          </ul>
        </div>

        <!-- ── 중단: 미니 그래프 ── -->
        <div class="sidebar-section sidebar-section--mid">
          <p class="sidebar-label">연결 그래프</p>
          <div class="mini-graph-container" id="miniGraphContainer">
            <svg id="miniGraphSvg"></svg>
            <div id="miniGraphTooltip" class="mini-graph-tooltip"></div>
          </div>
        </div>

        <!-- ── 하단: 태그 + 태그 검색 ── -->
        <div class="sidebar-section sidebar-section--bot">
          <p class="sidebar-label">태그</p>
          <div class="tag-search-wrap">
            <input type="text" id="tagSearchInput" class="tag-search-input"
              placeholder="태그 검색..." autocomplete="off" spellcheck="false" />
          </div>
          <div class="tag-chips-scroll">
            <div class="filter-chips" id="tagChips"></div>
          </div>
        </div>

      </div>
    </aside>

    <!-- ── 오른쪽 메인 영역 (뷰 전환 대상) ── -->
    <main class="posts-main">

      <!-- ══ 목록 뷰 (기본 표시) ══ -->
      <div id="listView">
        <div class="list-toolbar">
          <p class="search-result-info" id="searchResultInfo"></p>
          <div class="sort-bar" id="sortBar">
            <button class="sort-btn active" data-sort="newest">최신순</button>
            <button class="sort-btn" data-sort="oldest">오래된순</button>
            <button class="sort-btn" data-sort="title">제목순</button>
          </div>
        </div>
        <div class="posts-grid" id="postsGrid">
          <p style="color:var(--text-muted);padding:1rem">불러오는 중...</p>
        </div>
      </div>

      <!-- ══ 포스트 뷰 (클릭 시 표시) ══ -->
      <div id="postView" class="view-hidden">

        <!-- 본문 영역 -->
        <article>
          <!-- 뒤로가기 버튼 (router.js가 클릭을 가로챔) -->
          <a href="index.html" class="back-btn" id="backBtn">← 목록으로</a>

          <!-- 포스트 헤더 (제목/날짜/카테고리) -->
          <div class="post-header" id="postHeader"></div>

          <!-- 마크다운 본문 -->
          <div class="post-body" id="postBody"></div>
        </article>

        <!-- ToC 사이드바 -->
        <aside class="toc-sidebar" id="tocSidebar">
          <p class="toc-title">목차</p>
          <ul class="toc-list" id="tocList"></ul>
        </aside>

      </div>

    </main>

  </div>

  <script type="module" src="js/app-index.js"></script>

</body>
</html>
````


## `post.html`

````html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>포스트 — My Blog</title>
  <!-- 섬광 방지: CSS 로드 전에 다크모드 + 프리셋 컬러 즉시 적용 -->
  <script>
    (function () {
      var P=[{a:'#6366f1',l:'rgba(99,102,241,0.13)'},{a:'#3b82f6',l:'rgba(59,130,246,0.13)'},{a:'#10b981',l:'rgba(16,185,129,0.13)'},{a:'#06b6d4',l:'rgba(6,182,212,0.13)'},{a:'#8b5cf6',l:'rgba(139,92,246,0.13)'},{a:'#ec4899',l:'rgba(236,72,153,0.13)'},{a:'#f43f5e',l:'rgba(244,63,94,0.13)'},{a:'#f97316',l:'rgba(249,115,22,0.13)'}];
      try {
        if (JSON.parse(localStorage.getItem('theme'))==='dark') document.documentElement.classList.add('dark');
        var i=parseInt(localStorage.getItem('accent_preset'),10), p=P[isNaN(i)?0:Math.min(Math.max(i,0),P.length-1)];
        document.documentElement.style.setProperty('--accent',p.a);
        document.documentElement.style.setProperty('--accent-light',p.l);
      } catch(e) {}
    })();
  </script>

  <meta name="description"         content="" />
  <meta property="og:type"         content="article" />
  <meta property="og:title"        content="" />
  <meta property="og:description"  content="" />
  <meta property="og:url"          content="" />
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="" />
  <meta name="twitter:description" content="" />

  <link rel="stylesheet" href="css/variables.css" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/header.css" />
  <link rel="stylesheet" href="css/filters.css" />
  <link rel="stylesheet" href="css/cards.css" />
  <link rel="stylesheet" href="css/post.css" />
  <link rel="stylesheet" href="css/code.css" />       <!-- 코드 하이라이팅 + 헤더 토글 -->
  <link rel="stylesheet" href="css/toc.css" />
  <link rel="stylesheet" href="css/sidebar.css" />     <!-- 왼쪽 카테고리 사이드바 -->
  <link rel="stylesheet" href="css/search.css" />      <!-- 검색바 -->
  <link rel="stylesheet" href="css/responsive.css" />
  <link rel="stylesheet" href="css/music-player.css" />

  <script src="https://cdn.jsdelivr.net/npm/marked@9/marked.min.js"></script>
  <!-- highlight.js: 코드 블록 문법 하이라이팅 (색은 css/code.css에서 지정) -->
  <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js"></script>
</head>
<body>

  <!-- 헤더 -->
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="site-title">My<span>Blog</span></a>
      <div class="header-controls">
        <a href="editor.html" id="writeBtn" class="theme-toggle">✏️ 글쓰기</a>
        <div class="color-preset-wrap" id="colorPresetWrap">
          <button class="theme-toggle" id="colorPresetBtn" aria-expanded="false" aria-label="테마 색상 변경">
            <span class="color-dot" id="colorDot"></span>
            <span>색상</span>
          </button>
          <div class="color-preset-popup" id="colorPresetPopup"></div>
        </div>
        <button class="theme-toggle" id="themeToggle" aria-label="테마 전환">
          <span id="themeIcon">🌙</span>
          <span id="themeLabel">다크</span>
        </button>
      </div>
    </div>
  </header>

  <!-- ══════════════════════════════════
       3열 레이아웃: 사이드바 | 본문 | ToC
       ══════════════════════════════════ -->
  <div class="post-page-outer">

    <!-- ── 왼쪽: 카테고리 사이드바 ── -->
    <aside class="category-sidebar post-sidebar">

      <!-- 모바일 토글 버튼 -->
      <button class="sidebar-toggle" id="sidebarToggle">
        📂 카테고리
        <span class="toggle-arrow" style="margin-left:auto">▼</span>
      </button>

      <div class="sidebar-content open" id="sidebarContent">

        <!-- 검색바 (사이드바 최상단) -->
        <div class="sidebar-section">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              id="searchInput"
              class="search-input"
              placeholder="검색 후 목록에서 보기..."
              autocomplete="off"
              spellcheck="false"
            />
            <button class="search-clear" id="searchClear" title="검색어 지우기">✕</button>
          </div>
        </div>

        <!-- 카테고리 트리 -->
        <div class="sidebar-section">
          <p class="sidebar-label">카테고리</p>
          <ul class="category-tree" id="categoryTree">
            <li style="color:var(--text-muted);font-size:0.82rem;padding:0.3rem 0.5rem">불러오는 중...</li>
          </ul>
        </div>

      </div>
    </aside>

    <!-- ── 오른쪽: 본문 + ToC ── -->
    <div class="post-content-area">

      <a href="index.html" class="back-btn">← 목록으로</a>

      <div class="post-layout">

        <!-- 본문 -->
        <article>
          <div class="post-header" id="postHeader">
            <div style="height:1rem;background:var(--border);border-radius:4px;width:80px;margin-bottom:1rem;opacity:.4"></div>
            <div style="height:2rem;background:var(--border);border-radius:4px;width:60%;margin-bottom:.75rem;opacity:.4"></div>
            <div style="height:.8rem;background:var(--border);border-radius:4px;width:40%;opacity:.4"></div>
          </div>
          <div class="post-body" id="postBody">
            <p style="color:var(--text-muted)">글을 불러오는 중...</p>
          </div>
        </article>

        <!-- ToC -->
        <aside class="toc-sidebar" id="tocSidebar">
          <p class="toc-title">목차</p>
          <ul class="toc-list" id="tocList"></ul>
        </aside>

      </div>
    </div>

  </div>

  <script type="module" src="js/app-post.js"></script>

</body>
</html>
````


## `editor.html`

````html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>글 작성 — My Blog</title>
  <!-- 섬광 방지: CSS 로드 전에 다크모드 + 프리셋 컬러 즉시 적용 -->
  <script>
    (function () {
      var P=[{a:'#6366f1',l:'rgba(99,102,241,0.13)'},{a:'#3b82f6',l:'rgba(59,130,246,0.13)'},{a:'#10b981',l:'rgba(16,185,129,0.13)'},{a:'#06b6d4',l:'rgba(6,182,212,0.13)'},{a:'#8b5cf6',l:'rgba(139,92,246,0.13)'},{a:'#ec4899',l:'rgba(236,72,153,0.13)'},{a:'#f43f5e',l:'rgba(244,63,94,0.13)'},{a:'#f97316',l:'rgba(249,115,22,0.13)'}];
      try {
        if (JSON.parse(localStorage.getItem('theme'))==='dark') document.documentElement.classList.add('dark');
        var i=parseInt(localStorage.getItem('accent_preset'),10), p=P[isNaN(i)?0:Math.min(Math.max(i,0),P.length-1)];
        document.documentElement.style.setProperty('--accent',p.a);
        document.documentElement.style.setProperty('--accent-light',p.l);
      } catch(e) {}
    })();
  </script>

  <link rel="stylesheet" href="css/variables.css" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/header.css" />
  <link rel="stylesheet" href="css/cards.css" />    <!-- .post-category, .post-tag 공유 -->
  <link rel="stylesheet" href="css/post.css" />     <!-- .post-body 마크다운 스타일 공유 -->
  <link rel="stylesheet" href="css/code.css" />     <!-- 코드 하이라이팅 + 헤더 토글 (미리보기 공유) -->
  <link rel="stylesheet" href="css/editor.css" />   <!-- 에디터 전용 스타일 -->

  <!-- marked.js: 실시간 미리보기용 마크다운 파서 -->
  <script src="https://cdn.jsdelivr.net/npm/marked@9/marked.min.js"></script>
  <!-- highlight.js: 미리보기 코드 블록 하이라이팅 -->
  <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js"></script>

  <!-- 에디터 페이지는 body가 전체 높이를 차지해야 합니다 -->
  <style>
    body { overflow: hidden; } /* 페이지 자체는 스크롤 안 함, 패널이 각자 스크롤 */
  </style>
</head>
<body>

  <!-- ══════════════════════════════════
       헤더
       ══════════════════════════════════ -->
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="site-title">My<span>Blog</span></a>
      <div class="header-controls">
        <div class="color-preset-wrap" id="colorPresetWrap">
          <button class="theme-toggle" id="colorPresetBtn" aria-expanded="false" aria-label="테마 색상 변경">
            <span class="color-dot" id="colorDot"></span>
            <span>색상</span>
          </button>
          <div class="color-preset-popup" id="colorPresetPopup"></div>
        </div>
        <button class="theme-toggle" id="themeToggle" aria-label="테마 전환">
          <span id="themeIcon">🌙</span>
          <span id="themeLabel">다크</span>
        </button>
      </div>
    </div>
  </header>

  <!-- ══════════════════════════════════
       에디터 전체 영역
       ══════════════════════════════════ -->
  <div class="editor-page">

    <!-- 상단 툴바: 파일명 입력 + 액션 버튼들 -->
    <div class="editor-toolbar">
      <div class="editor-toolbar-left">
        <!-- 목록으로 돌아가기 -->
        <a href="index.html" class="toolbar-btn">← 목록</a>

        <!-- 파일 경로 입력 (posts/ 기준 상대 경로) -->
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <span style="font-size:0.82rem;color:var(--text-muted);font-family:var(--font-code)">posts/</span>
          <input
            type="text"
            id="filenameInput"
            class="filename-input"
            placeholder="(선택) 비우면 카테고리+제목으로 자동 · 직접: 개발/hello.md"
          />
        </div>
      </div>

      <div class="editor-toolbar-right">
        <!-- 새 글 -->
        <button class="toolbar-btn" id="newBtn">＋ 새 글</button>
        <!-- 로컬 저장 (File System Access API) -->
        <button class="toolbar-btn" id="saveBtn">💾 로컬 저장</button>
        <!-- GitHub 게시 -->
        <button class="toolbar-btn primary" id="publishBtn">🚀 GitHub에 게시</button>
        <!-- 삭제 (수정으로 불러왔을 때만 표시) -->
        <button class="toolbar-btn danger" id="deleteBtn" style="display:none" title="이 글 삭제">🗑️ 삭제</button>
        <!-- GitHub 설정 -->
        <div style="position:relative">
          <button class="toolbar-btn" id="ghSettingsBtn" title="GitHub 설정">⚙️</button>

          <!-- GitHub 설정 드롭다운 패널 -->
          <div class="gh-settings-panel" id="ghSettingsPanel">
            <p class="gh-settings-title">⚙️ 설정</p>
            <p class="gh-settings-desc">
              한 번만 입력하면 이후 자동 저장됩니다.<br>
              모든 값은 이 브라우저에만 저장됩니다.
            </p>

            <div class="gh-section-label">🐙 GitHub</div>

            <label class="gh-label">
              GitHub Token
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=Blog+Editor"
                 target="_blank" class="gh-token-link">발급받기 →</a>
            </label>
            <input type="password" id="gh_token" class="gh-input"
                   placeholder="ghp_xxxxxxxxxxxx" autocomplete="off" />

            <label class="gh-label">GitHub 아이디 (owner)</label>
            <input type="text" id="gh_owner" class="gh-input" placeholder="내아이디" />

            <label class="gh-label">저장소 이름 (repo)</label>
            <input type="text" id="gh_repo" class="gh-input" placeholder="blog" />

            <label class="gh-label">브랜치</label>
            <input type="text" id="gh_branch" class="gh-input" placeholder="main" value="main" />

            <button class="gh-save-btn" id="ghSaveSettingsBtn">저장</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 좌우 분할 패널 -->
    <div class="editor-panels">

      <!-- ══ 왼쪽: 에디터 패널 ══ -->
      <div class="editor-left">

        <!-- Front Matter 폼 -->
        <div class="frontmatter-form">
          <!-- 제목 (전체 너비) -->
          <div class="full-width">
            <label class="fm-label" for="fmTitle">제목</label>
            <input type="text" id="fmTitle" class="fm-input" placeholder="글 제목을 입력하세요" />
          </div>

          <!-- 날짜 -->
          <div>
            <label class="fm-label" for="fmDate">날짜</label>
            <input type="date" id="fmDate" class="fm-input" />
          </div>

          <!-- 카테고리 -->
          <div>
            <label class="fm-label" for="fmCategorySelect">카테고리</label>
            <select id="fmCategorySelect" class="fm-input">
              <!-- JS(editor.js)가 posts.json에서 읽어 채웁니다 -->
            </select>
            <!-- 실제 저장에 쓰이는 값. 드롭다운이 이 값을 세팅함.
                 '직접 입력' 선택 시에만 보이는 새 카테고리 입력칸 -->
            <input type="text" id="fmCategory" class="fm-input"
                   placeholder="새 카테고리 (예: 개발/javascript)"
                   style="display:none; margin-top:8px;" />
          </div>

          <!-- 태그 (전체 너비) -->
          <div class="full-width">
            <label class="fm-label" for="fmTags">태그 (쉼표로 구분)</label>
            <input type="text" id="fmTags" class="fm-input" placeholder="예: JavaScript, 입문, 튜토리얼" />
          </div>

          <!-- 요약 (전체 너비) -->
          <div class="full-width">
            <label class="fm-label" for="fmExcerpt">요약 <span style="font-weight:400;text-transform:none">(비우면 본문에서 자동 생성)</span></label>
            <input type="text" id="fmExcerpt" class="fm-input" placeholder="목록 카드에 표시될 요약문" />
          </div>
        </div>

        <!-- 서식 버튼 바 -->
        <div class="editor-format-bar" id="formatBar">
          <button class="fmt-btn" data-format="h2"        title="제목 2 (##)">H2</button>
          <button class="fmt-btn" data-format="h3"        title="제목 3 (###)">H3</button>
          <div class="fmt-divider"></div>
          <button class="fmt-btn" data-format="bold"      title="굵게 (**텍스트**)"><strong>B</strong></button>
          <button class="fmt-btn" data-format="italic"    title="기울임 (*텍스트*)"><em>I</em></button>
          <button class="fmt-btn" data-format="strike"    title="취소선 (~~텍스트~~)"><s>S</s></button>
          <div class="fmt-divider"></div>
          <button class="fmt-btn" data-format="code"      title="인라인 코드 (`코드`)">` `</button>
          <button class="fmt-btn" data-format="codeblock" title="코드 블록 (```코드```)">```</button>
          <div class="fmt-divider"></div>
          <button class="fmt-btn" data-format="link"      title="링크 ([텍스트](URL))">🔗</button>
          <button class="fmt-btn" data-format="image"     title="이미지 (![설명](URL))">🖼️</button>
          <div class="fmt-divider"></div>
          <button class="fmt-btn" data-format="quote"     title="인용문 (> 텍스트)">&ldquo;&rdquo;</button>
          <button class="fmt-btn" data-format="ul"        title="순서 없는 목록 (- 항목)">• 목록</button>
          <button class="fmt-btn" data-format="ol"        title="순서 있는 목록 (1. 항목)">1. 목록</button>
          <button class="fmt-btn" data-format="hr"        title="구분선 (---)">—</button>
        </div>

        <!-- 마크다운 입력 textarea -->
        <textarea
          id="editorTextarea"
          class="editor-textarea"
          placeholder="여기에 마크다운으로 글을 작성하세요...

## 소제목
본문 내용을 입력합니다.

### 더 작은 제목
- 목록 항목 1
- 목록 항목 2

\`\`\`javascript
// 코드 블록
const hello = 'world';
\`\`\`"
          spellcheck="false"
        ></textarea>

      </div>

      <!-- ══ 오른쪽: 미리보기 패널 ══ -->
      <div class="editor-right">
        <div class="preview-header">📄 미리보기</div>

        <div class="preview-body">
          <!-- 포스트 헤더 미리보기 (제목, 날짜, 태그) -->
          <div class="preview-post-header post-header" id="previewHeader">
            <span style="color:var(--text-muted);font-size:0.9rem">Front Matter 정보가 여기에 표시됩니다</span>
          </div>

          <!-- 본문 미리보기 (마크다운 → HTML) -->
          <div class="post-body" id="previewBody">
            <div class="preview-empty">
              <div class="icon">✏️</div>
              <p>왼쪽에서 마크다운을 입력하면<br>여기에 미리보기가 표시됩니다.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <script type="module" src="js/app-editor.js"></script>

</body>
</html>
````


## `js/app-index.js`

````javascript
/**
 * js/app-index.js — 메인 페이지 진입점 (SPA)
 *
 * ── SPA 구조 ──
 *   이 파일이 목록 뷰와 포스트 뷰를 모두 담당합니다.
 *   페이지 이동 없이 콘텐츠만 교체하므로 뮤직 플레이어가 끊기지 않습니다.
 *
 *   목록 뷰: PostsLoader → Sidebar → Filter → Search → Renderer
 *   포스트 뷰: router:post 이벤트 → Markdown 렌더링 → Toc 생성
 *
 * ── 새 기능 추가 방법 ──
 *   1. js/modules/새기능.js 파일 생성
 *   2. import 추가
 *   3. App.register('새기능', 모듈) 추가
 */

import App         from './core/app.js';
import Theme       from './core/theme.js';
import Accent      from './core/accent.js';
import Env         from './core/env.js';
import Config      from './core/config.js';
import Router      from './core/router.js';
import PostsLoader from './modules/posts-loader.js';
import Sidebar     from './modules/sidebar.js';
import Filter      from './modules/filter.js';
import Search      from './modules/search.js';
import Renderer    from './modules/renderer.js';
import Markdown    from './modules/markdown.js';
import Toc         from './modules/toc.js';
import PostEnhance from './modules/post-enhance.js';
import MusicPlayer from './modules/music-player.js';
import Graph       from './modules/graph.js';

// ── 코어 초기화 ──
Theme.init();
Accent.init();

// ── 로컬 환경에서만 글쓰기 버튼 표시 ──
const writeBtn = document.getElementById('writeBtn');
// 글쓰기 버튼은 항상 표시 (에디터 진입 시 비번 잠금이 보호)

// ── 사이드바 로고 클릭: SPA 라우터로 목록 뷰 복귀 ──
document.getElementById('siteLogo')?.addEventListener('click', (e) => {
  // 포스트 뷰에 있을 때만 라우터로 처리 (목록 뷰에서는 기본 동작)
  if (!document.getElementById('postView')?.classList.contains('view-hidden')) {
    e.preventDefault();
    Router.goList();
  }
});

// ── 기능 모듈 등록 ──
App.register('sidebar',  Sidebar);
App.register('filter',   Filter);
App.register('search',   Search);
App.register('renderer', Renderer);
App.register('music',    MusicPlayer);
App.register('graph',    Graph);

// ══════════════════════════════════════════════════════════
// 포스트 뷰 처리: router:post 이벤트 수신 → 마크다운 렌더링
// ══════════════════════════════════════════════════════════

/**
 * 날짜 문자열을 '2024년 1월 15일' 형식으로 변환합니다.
 * @param {string} dateStr
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * SEO 메타태그를 동적으로 업데이트합니다.
 * SNS 공유 미리보기, 탭 제목 등에 반영됩니다.
 */
function updateSeoMeta(meta, file) {
  const title       = meta.title ? `${meta.title} — ${Config.siteName}` : Config.siteName;
  const description = meta.excerpt || Config.description;
  const pageUrl     = `${Config.siteUrl}/index.html?file=${encodeURIComponent(file)}`;

  document.title = title;
  _setMeta('name',     'description',    description);
  _setMeta('property', 'og:title',       title);
  _setMeta('property', 'og:description', description);
  _setMeta('property', 'og:url',         pageUrl);
  _setMeta('property', 'og:type',        'article');
  _setMeta('name',     'twitter:title',       title);
  _setMeta('name',     'twitter:description', description);
}

function _setMeta(attr, name, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[${attr}="${name}"]`);
  if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attr, name); document.head.appendChild(tag); }
  tag.setAttribute('content', content);
}

/** 포스트 헤더(제목, 날짜, 카테고리, 태그)를 렌더링합니다. */
function renderPostHeader(meta, file) {
  const header = document.getElementById('postHeader');
  if (!header) return;
  header.innerHTML = `
    ${meta.category ? `<span class="post-category">${meta.category}</span>` : ''}
    <h1>${meta.title || '제목 없음'}</h1>
    <div class="post-card-meta">
      <span class="post-date">${formatDate(meta.date)}</span>
      <div class="post-tags">
        ${(meta.tags || []).map(t => `<span class="post-tag">#${t}</span>`).join('')}
      </div>
      <a class="post-edit-btn" href="editor.html?edit=${encodeURIComponent(file)}" title="이 글 수정" style="font-size:.78rem;color:var(--text-muted);text-decoration:none;border:1px solid var(--border);border-radius:6px;padding:.15rem .55rem;margin-left:auto;white-space:nowrap">✏️ 수정</a>
    </div>
  `;
}

// 포스트 뷰 전환 이벤트: 마크다운 파일 로드 → 렌더링 → ToC
App.on('router:post', async ({ file }) => {
  const bodyEl   = document.getElementById('postBody');
  const headerEl = document.getElementById('postHeader');

  // 로딩 중 플레이스홀더
  if (headerEl) headerEl.innerHTML = `
    <div style="height:1rem;background:var(--border);border-radius:4px;width:80px;margin-bottom:1rem;opacity:.4"></div>
    <div style="height:2rem;background:var(--border);border-radius:4px;width:60%;margin-bottom:.75rem;opacity:.4"></div>
  `;
  if (bodyEl) bodyEl.innerHTML = `<p style="color:var(--text-muted)">불러오는 중...</p>`;

  try {
    const res = await fetch(`posts/${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();

    const { meta, content } = Markdown.parseFrontMatter(raw);

    renderPostHeader(meta, file);
    updateSeoMeta(meta, file);
    bodyEl.innerHTML = Markdown.parse(content);

    // ToC는 본문 삽입 후에 빌드해야 합니다
    Toc.build();

    // 코드 하이라이팅 + 헤더 토글 (ToC 이후에 실행 — heading id 유지됨)
    PostEnhance.apply(bodyEl);

  } catch (err) {
    console.error('[app-index] 포스트 로딩 실패:', err);
    if (headerEl) headerEl.innerHTML = '';
    if (bodyEl) bodyEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😵</div>
        <p>포스트를 불러올 수 없습니다.</p>
        <p style="font-size:.85rem;margin-top:.5rem">${err.message}</p>
      </div>`;
  }
});

// 목록 뷰 복귀: 제목 복원
App.on('router:list', () => {
  document.title = Config.siteName || 'My Blog';
});

// ── 라우터 초기화 (App.on 등록 후에 해야 F5 새로고침 시 이벤트가 전달됨) ──
Router.init();

// ══════════════════════════════════════════════════════════
// 포스트 데이터 로드 + URL 파라미터 복원
// ══════════════════════════════════════════════════════════

PostsLoader.load().then(() => {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('category');
  const q   = params.get('search');

  if (cat) {
    Sidebar.applyFromUrl(cat);
  }
  if (q) {
    const input = document.getElementById('searchInput');
    if (input) { input.value = q; }
    const clearBtn = document.getElementById('searchClear');
    if (clearBtn) clearBtn.style.display = 'flex';
    App.emit('filter:search', { query: q });
  }

  // URL 파라미터 정리 (히스토리에 남지 않도록)
  if ((cat || q) && !params.get('file')) {
    history.replaceState(null, '', 'index.html');
  }
}).catch(() => {
  const grid = document.getElementById('postsGrid');
  if (grid) grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">😵</div>
      <p>포스트를 불러올 수 없습니다.</p>
      <p style="font-size:.85rem;margin-top:.5rem">node server.js 로 실행 중인지 확인하세요.</p>
    </div>`;
});
````


## `js/app-post.js`

````javascript
/**
 * js/app-post.js — 포스트 상세 페이지(post.html) 진입점
 *
 * URL의 ?file= 파라미터로 마크다운 파일을 특정하고
 * 렌더링 후 ToC를 생성합니다.
 */

import App         from './core/app.js';
import Theme       from './core/theme.js';
import Accent      from './core/accent.js';
import Env         from './core/env.js';
import Config      from './core/config.js';
import PostsLoader from './modules/posts-loader.js';
import Sidebar     from './modules/sidebar.js';
import Markdown    from './modules/markdown.js';
import Toc         from './modules/toc.js';
import PostEnhance from './modules/post-enhance.js';
import MusicPlayer from './modules/music-player.js';

// ── 코어 초기화 ──
Theme.init();
Accent.init();
MusicPlayer.init();

// ── 사이드바: 카테고리 트리 렌더링 (탐색 전용, 필터링 X) ──
App.register('sidebar', Sidebar);
PostsLoader.load().catch(() => {});

// ── 검색바: 입력 후 Enter 또는 아이콘 클릭 시 index.html?search=... 이동 ──
// (post.html에선 목록이 없으므로 index로 이동해서 검색 결과를 보여줌)
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
if (searchInput) {
  const goSearch = () => {
    const q = searchInput.value.trim();
    if (q) window.location.href = `index.html?search=${encodeURIComponent(q)}`;
    else   window.location.href = 'index.html';
  };
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') goSearch(); });
  // 아이콘 클릭도 이동
  document.querySelector('.search-icon')?.addEventListener('click', goSearch);
}
if (searchClear) {
  searchClear.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchClear.style.display = 'none';
  });
}
// X 버튼 표시 제어
searchInput?.addEventListener('input', () => {
  if (searchClear) searchClear.style.display = searchInput.value ? 'flex' : 'none';
});

// ── 환경에 따라 글쓰기 버튼 표시/숨김 ──
const writeBtn = document.getElementById('writeBtn');
// 글쓰기 버튼은 항상 표시 (에디터 진입 시 비번 잠금이 보호)

// ── URL에서 파일 경로 읽기 ──
const params = new URLSearchParams(window.location.search);
const file   = params.get('file');

if (!file) window.location.href = 'index.html';

/**
 * 날짜 문자열을 한국어 형식으로 변환합니다.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string}        - '2024년 1월 15일'
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * SEO 관련 <meta> 태그를 동적으로 업데이트합니다.
 *
 * 검색엔진과 SNS 공유 시 보여지는 정보를 설정합니다.
 * og: → Open Graph (카카오, 페이스북 등 미리보기)
 * twitter: → 트위터 카드 미리보기
 *
 * @param {Object} meta     - Front Matter 메타데이터
 * @param {string} excerpt  - 포스트 요약
 */
function updateSeoMeta(meta, excerpt) {
  const title       = meta.title ? `${meta.title} — ${Config.siteName}` : Config.siteName;
  const description = excerpt || meta.excerpt || Config.description;
  const pageUrl     = `${Config.siteUrl}/post.html?file=${encodeURIComponent(file)}`;

  // 브라우저 탭 제목
  document.title = title;

  // description
  setMeta('name', 'description', description);

  // Open Graph (SNS 공유 미리보기)
  setMeta('property', 'og:title',       title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url',         pageUrl);
  setMeta('property', 'og:type',        'article');
  setMeta('property', 'og:site_name',   Config.siteName);

  // Twitter Card
  setMeta('name', 'twitter:card',        'summary');
  setMeta('name', 'twitter:title',       title);
  setMeta('name', 'twitter:description', description);

  // Canonical URL (중복 URL 방지)
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = pageUrl;
}

/**
 * meta 태그를 찾아서 content를 업데이트합니다.
 * 태그가 없으면 새로 생성합니다. (내부 헬퍼)
 *
 * @param {string} attrName  - 'name' 또는 'property'
 * @param {string} attrValue - 태그의 name/property 값
 * @param {string} content   - 설정할 content 값
 */
function setMeta(attrName, attrValue, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * 포스트 헤더(제목, 날짜, 카테고리, 태그)를 DOM에 렌더링합니다.
 * @param {Object} meta - Front Matter 파싱 결과
 */
function renderHeader(meta) {
  const header = document.getElementById('postHeader');
  if (!header) return;

  const categoryBadge = meta.category
    ? `<span class="post-category">${meta.category}</span>`
    : '';

  const tagsHTML = (meta.tags || [])
    .map(t => `<span class="post-tag">#${t}</span>`)
    .join('');

  header.innerHTML = `
    ${categoryBadge}
    <h1>${meta.title || '제목 없음'}</h1>
    <div class="post-card-meta">
      <span class="post-date">${formatDate(meta.date)}</span>
      <div class="post-tags">${tagsHTML}</div>
      <a class="post-edit-btn" href="editor.html?edit=${encodeURIComponent(file)}" title="이 글 수정" style="font-size:.78rem;color:var(--text-muted);text-decoration:none;border:1px solid var(--border);border-radius:6px;padding:.15rem .55rem;margin-left:auto;white-space:nowrap">✏️ 수정</a>
    </div>
  `;
}

/**
 * 마크다운 파일을 불러와서 렌더링하고 ToC를 생성합니다.
 */
async function loadPost() {
  const bodyEl   = document.getElementById('postBody');
  const headerEl = document.getElementById('postHeader');

  try {
    const res = await fetch(`posts/${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.text();
    const { meta, content } = Markdown.parseFrontMatter(raw);

    // 헤더 렌더링
    renderHeader(meta);

    // SEO 메타 태그 업데이트
    updateSeoMeta(meta, meta.excerpt || content.slice(0, 150).replace(/[#*`>\n]/g, ' ').trim());

    // 마크다운 → HTML 변환
    bodyEl.innerHTML = Markdown.parse(content);

    // ToC 생성 (본문 삽입 후에 호출)
    Toc.build();

    // 코드 하이라이팅 + 헤더 토글 (ToC 이후에 실행 — heading id 유지됨)
    PostEnhance.apply(bodyEl);

  } catch (err) {
    console.error('[app-post] 포스트 로딩 실패:', err);
    if (headerEl) headerEl.innerHTML = '';
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😵</div>
          <p>포스트를 불러올 수 없습니다.</p>
          <p style="font-size:0.85rem;margin-top:0.5rem">${err.message}</p>
        </div>`;
    }
  }
}

loadPost();
````


## `js/app-editor.js`

````javascript
/**
 * js/app-editor.js — 에디터 페이지 진입점
 */

import Theme  from './core/theme.js';
import Accent from './core/accent.js';
import Editor     from './modules/editor.js';
import EditorAuth from './modules/editor-auth.js';

Theme.init();
Accent.init();
Editor.init();
EditorAuth.init();   // 에디터 진입 잠금(비번) + GitHub 토큰 보관
````

