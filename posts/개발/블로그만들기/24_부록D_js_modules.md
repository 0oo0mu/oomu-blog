---
title: [블로그 만들기] 부록 D. js/modules 전체 (기능 모듈)
date: 2026-07-14
category: 개발/블로그만들기
tags: [블로그만들기, 부록, 자바스크립트, 전체코드]
excerpt: 글 로더·사이드바·필터·검색·렌더러·마크다운·목차·그래프·뮤직플레이어·후처리·에디터·잠금 등 기능 모듈(js/modules) 전체 코드입니다. 그래프·에디터 등 본편에서 요약했던 파일의 완전한 코드가 모두 여기 있습니다.
---

# 부록 D — js/modules 전체 (기능 모듈)

글 로더·사이드바·필터·검색·렌더러·마크다운·목차·그래프·뮤직플레이어·후처리·에디터·잠금 등 기능 모듈(js/modules) 전체 코드입니다. 그래프·에디터 등 본편에서 요약했던 파일의 완전한 코드가 모두 여기 있습니다.

> 이 부록은 **실제 파일의 완전한 코드**입니다. 각 파일이 왜 그렇게 동작하는지는 해당 본편(00~20)에서 설명했고, 여기서는 그대로 옮겨 적을 수 있도록 전체를 싣습니다. 파일 경로 그대로 만들어 붙여넣으면 됩니다.

## `js/modules/posts-loader.js`

````javascript
/**
 * js/modules/posts-loader.js — 포스트 데이터 로더
 *
 * posts/posts.json을 fetch로 가져와서 파싱하고,
 * 날짜 순으로 정렬한 뒤 App 이벤트로 알려줍니다.
 *
 * 발행하는 이벤트:
 *   'posts:loaded' → { posts: Post[] }
 *   'posts:error'  → { error: Error }
 *
 * Post 객체 구조:
 *   {
 *     file:     string,   // 파일 경로 (예: "개발/js/hello.md")
 *     title:    string,
 *     date:     string,   // "YYYY-MM-DD"
 *     category: string,   // 폴더 계층 (예: "개발/js")
 *     tags:     string[],
 *     excerpt:  string,
 *   }
 */

import App from '../core/app.js';

/** 캐시: 한 번 불러온 포스트는 재요청하지 않음 */
let _cache = null;
/** 캐시: 폴더 기반 카테고리 목록(빈 폴더 포함) */
let _catCache = null;

const PostsLoader = {
  /**
   * posts/posts.json을 불러오고 'posts:loaded' 이벤트를 발행합니다.
   * 이미 로드된 경우 캐시된 데이터를 그대로 씁니다.
   *
   * @returns {Promise<Post[]>} 정렬된 포스트 배열
   */
  async load() {
    // 캐시 있으면 재사용
    if (_cache) {
      App.emit('posts:loaded', { posts: _cache, categories: _catCache || [] });
      return _cache;
    }

    try {
      const res = await fetch('posts/posts.json');
      if (!res.ok) throw new Error(`posts.json 불러오기 실패: HTTP ${res.status}`);

      const posts = await res.json();

      // 날짜 내림차순 정렬 (최신 글이 먼저)
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));

      // 폴더 기반 카테고리 목록(빈 폴더 포함) — 없으면 빈 배열로 폴백
      let categories = [];
      try {
        const cres = await fetch('posts/categories.json');
        if (cres.ok) categories = await cres.json();
      } catch (_) { /* categories.json 없어도 정상 동작 */ }

      _cache = posts;
      _catCache = categories;
      App.emit('posts:loaded', { posts, categories });
      return posts;

    } catch (error) {
      console.error('[PostsLoader]', error);
      App.emit('posts:error', { error });
      throw error;
    }
  },

  /**
   * 캐시를 초기화합니다.
   * build.js로 posts.json을 재생성한 뒤 새로고침 없이
   * 목록을 다시 불러올 때 사용합니다. (현재는 예비용)
   */
  clearCache() {
    _cache = null;
  },
};

export default PostsLoader;
````


## `js/modules/sidebar.js`

````javascript
/**
 * js/modules/sidebar.js — 왼쪽 카테고리 사이드바
 *
 * 'posts:loaded' 이벤트를 받아서 카테고리 폴더 구조를 트리로 표시합니다.
 *
 * 동작:
 *   - posts.json의 category 값(예: "PC/언어/C")을 파싱해서 트리 구조 생성
 *   - 하위 카테고리의 포스트 수를 상위에 합산해서 표시
 *   - 클릭 시 'filter:category' 이벤트 발행 → filter.js가 처리
 *   - 폴더 노드는 클릭 시 펼치기/접기 (화살표 회전)
 *
 * 발행하는 이벤트:
 *   'filter:category' → { category: string }
 *     category = 'all'이면 전체, 아니면 해당 경로로 시작하는 포스트만
 *
 * 구독하는 이벤트:
 *   'posts:loaded' → 트리 빌드
 */

import App    from '../core/app.js';
import Router from '../core/router.js';

const Sidebar = {
  _allPosts: [],

  /**
   * 초기화: 이벤트 구독 + 모바일 토글 연결
   * App.register('sidebar', Sidebar) 시 자동 호출됩니다.
   */
  init() {
    App.on('posts:loaded', ({ posts, categories }) => {
      this._allPosts = posts;
      this._categories = categories || [];
      this._build(posts, this._categories);
    });

    // 모바일 토글 버튼
    const toggleBtn = document.getElementById('sidebarToggle');
    const content   = document.getElementById('sidebarContent');
    if (toggleBtn && content) {
      toggleBtn.addEventListener('click', () => {
        const isOpen = content.classList.toggle('open');
        toggleBtn.querySelector('.toggle-arrow').textContent = isOpen ? '▲' : '▼';
      });
    }
  },

  /**
   * 포스트 목록에서 카테고리 트리를 빌드하고 DOM에 렌더링합니다.
   * @param {Post[]} posts
   * @param {string[]} [categories] - 폴더 기반 카테고리 목록(빈 폴더 포함)
   */
  _build(posts, categories = []) {
    const treeEl = document.getElementById('categoryTree');
    if (!treeEl) return;

    // ── 카테고리 트리를 스크롤 래퍼로 감싸기 ──
    // 트리가 이미 .category-tree-wrap 안에 있지 않으면 래퍼를 만들어 씌웁니다.
    if (!treeEl.parentElement.classList.contains('category-tree-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'category-tree-wrap';
      treeEl.parentNode.insertBefore(wrap, treeEl);
      wrap.appendChild(treeEl);

      // 스크롤이 끝에 도달하면 페이드 효과 제거 (내용이 잘리는 것처럼 보이지 않도록)
      wrap.addEventListener('scroll', () => {
        const atBottom = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 4;
        wrap.classList.toggle('scrolled-end', atBottom);
      });
    }

    // ── 트리 데이터 구조 생성 ──
    // 각 노드: { _posts: number, _children: { [name]: Node } }
    // _posts: 이 노드에 직접 속한 포스트 수 (하위 포함 X)
    const root = { _posts: posts.length, _children: {} };

    posts.forEach(post => {
      if (!post.category) return;
      // "PC/언어/C" → ['PC', '언어', 'C']
      const parts = post.category.split('/').filter(Boolean);
      let node = root;

      parts.forEach((part, depth) => {
        if (!node._children[part]) {
          node._children[part] = { _posts: 0, _children: {} };
        }
        // 마지막 파트에만 직접 포스트 수 +1
        if (depth === parts.length - 1) {
          node._children[part]._posts++;
        }
        node = node._children[part];
      });
    });

    // ── 폴더 기반 카테고리 병합 (글이 없는 빈 폴더도 트리에 표시) ──
    categories.forEach(cat => {
      const parts = cat.split('/').filter(Boolean);
      let node = root;
      parts.forEach(part => {
        if (!node._children[part]) {
          node._children[part] = { _posts: 0, _children: {} };
        }
        node = node._children[part];
      });
    });

    // ── 각 노드의 전체 포스트 수(하위 포함) 계산 ──
    calcTotal(root);

    // ── DOM 렌더링 ──
    treeEl.innerHTML = '';

    // "전체" 항목
    const allLi = document.createElement('li');
    allLi.className = 'tree-node';
    allLi.innerHTML = `
      <button class="tree-item tree-item-all active" data-category="all">
        <span class="tree-name">🗂 전체</span>
        <span class="tree-count">${posts.length}</span>
      </button>`;
    allLi.querySelector('.tree-item').addEventListener('click', () => {
      this._select('all');
    });
    treeEl.appendChild(allLi);

    // 루트의 자식 노드들을 재귀적으로 렌더링
    Object.entries(root._children).forEach(([name, node]) => {
      treeEl.appendChild(this._renderNode(name, node, ''));
    });
  },

  /**
   * 트리 노드 하나를 <li> 요소로 만들어 반환합니다.
   * 자식이 있으면 재귀적으로 하위 트리를 생성합니다.
   *
   * @param {string} name       - 폴더/카테고리 이름 (예: "PC")
   * @param {Object} node       - 트리 노드 객체 { _posts, _total, _children }
   * @param {string} parentPath - 상위 경로 (예: "PC/언어")
   * @returns {HTMLLIElement}
   */
  _renderNode(name, node, parentPath) {
    const fullPath   = parentPath ? `${parentPath}/${name}` : name;
    const hasChildren = Object.keys(node._children).length > 0;

    const li = document.createElement('li');
    li.className = 'tree-node';
    li.dataset.path = fullPath;

    // 버튼 HTML
    const btn = document.createElement('button');
    btn.className = 'tree-item';
    btn.dataset.category = fullPath;
    btn.innerHTML = `
      ${hasChildren ? `<span class="tree-arrow">▶</span>` : `<span class="tree-arrow" style="opacity:0">▶</span>`}
      <span class="tree-name">📁 ${name}</span>
      <span class="tree-count">${node._total}</span>
    `;

    // 클릭: 자식 있는 폴더는 열기/닫기 토글 + 선택
    btn.addEventListener('click', () => {
      if (hasChildren) {
        li.classList.toggle('open');
        // ★ _select()가 자신의 open 상태를 덮어쓰지 않도록
        //   여기서 toggle한 결과를 _select() 이후에도 유지해야 합니다.
        //   sidebar.js의 _select()는 "조상 노드만" 열도록 수정되어 있습니다.
      }
      this._select(fullPath);
    });

    li.appendChild(btn);

    // 하위 노드가 있으면 재귀 렌더링
    if (hasChildren) {
      const ul = document.createElement('ul');
      ul.className = 'tree-children';

      Object.entries(node._children).forEach(([childName, childNode]) => {
        ul.appendChild(this._renderNode(childName, childNode, fullPath));
      });

      li.appendChild(ul);
    }

    return li;
  },

  /**
   * 카테고리를 선택합니다.
   *
   * ── 페이지/뷰별 동작 ──
   *   ① standalone post.html    → index.html?category=... 로 페이지 이동
   *   ② SPA 포스트 뷰(index.html) → 목록 뷰로 전환 후 필터 적용
   *   ③ 목록 뷰(index.html)     → 바로 필터 적용
   *
   * ★ SPA 동작 흐름 (②):
   *   1. App.emit('nav:category-from-post') → app-index.js가 대기 카테고리 저장
   *   2. Router.goList() → #postView 숨기고 #listView 표시 → router:list 이벤트
   *   3. app-index.js의 router:list 핸들러 → Sidebar.applyFromUrl(저장된 카테고리)
   *   4. applyFromUrl → _select() 재호출 → 이번엔 목록 뷰이므로 ③ 경로로 처리
   *
   * @param {string} category - 선택된 카테고리 경로 또는 'all'
   */
  _select(category) {
    const treeEl = document.getElementById('categoryTree');

    // ── ① standalone post.html 확인 ──
    const path = window.location.pathname;
    const isIndex = path.endsWith('index.html')
                 || path.endsWith('/')
                 || path === '';

    if (!isIndex) {
      // standalone post.html: 목록 페이지로 이동
      window.location.href = category === 'all'
        ? 'index.html'
        : `index.html?category=${encodeURIComponent(category)}`;
      return;
    }

    // ── ② SPA 포스트 뷰 확인 ──
    // index.html이지만 #postView가 표시 중인 경우
    const postView = document.getElementById('postView');
    const isInPostView = postView && !postView.classList.contains('view-hidden');

    if (isInPostView) {
      // app-index.js에 대기 카테고리 알림 → router:list 이벤트 후 처리됨
      App.emit('nav:category-from-post', { category });
      Router.goList(); // 목록 뷰로 전환 (동기적으로 router:list 발행)
      return;
    }

    // ── ③ index.html 목록 뷰: 바로 필터링 ──
    if (treeEl) {
      // active 업데이트
      treeEl.querySelectorAll('.tree-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
      });

      // ── 조상 노드만 펼치기 (선택된 노드 자신은 제외) ──
      //
      // ★ 버그 원인이었던 부분:
      //   기존 코드는 parts.forEach로 선택된 노드 포함 전체를 열었음.
      //   클릭 핸들러에서 toggle()로 닫았어도 여기서 다시 open을 붙여버려서
      //   폴더가 절대 닫히지 않는 버그가 생겼음.
      //
      // ★ 수정:
      //   parts.slice(0, -1) → 마지막 요소(자기 자신) 제외, 조상만 처리.
      //   'PC/언어/C' 선택 → 'PC', 'PC/언어' 만 open, 'PC/언어/C' 는 건드리지 않음.
      //   'PC' 선택 → slice(0,-1) = [] → 아무것도 강제 열지 않음 → toggle 결과 유지.
      if (category !== 'all') {
        const parts = category.split('/');
        const ancestors = parts.slice(0, -1); // 자기 자신 제외
        let cur = '';
        ancestors.forEach(part => {
          cur = cur ? `${cur}/${part}` : part;
          const node = treeEl.querySelector(`[data-path="${cur}"]`);
          if (node) node.classList.add('open');
        });
      }
    }

    App.emit('filter:category', { category });
  },

  /**
   * URL 파라미터에서 카테고리를 복원합니다.
   * 클릭과 달리, 해당 노드 자신을 포함한 전체 경로를 모두 펼칩니다.
   * @param {string} category
   */
  applyFromUrl(category) {
    const treeEl = document.getElementById('categoryTree');

    if (treeEl && category && category !== 'all') {
      // 자기 자신 포함 전체 경로 펼치기 (URL 복원이므로 toggle 아님)
      const parts = category.split('/');
      let cur = '';
      parts.forEach(part => {
        cur = cur ? `${cur}/${part}` : part;
        const node = treeEl.querySelector(`[data-path="${cur}"]`);
        if (node) node.classList.add('open');
      });
    }

    // active 표시 + 필터 발행 (_select 중 조상 펼치기 중복 실행되지만 무해)
    this._select(category);
  },
};

/**
 * 트리 노드의 _total (하위 포스트 포함 전체 수)을 재귀적으로 계산합니다.
 * @param {Object} node - 트리 노드
 * @returns {number}    - 이 노드와 모든 하위 노드의 포스트 합계
 */
function calcTotal(node) {
  const childrenTotal = Object.values(node._children).reduce((sum, child) => {
    return sum + calcTotal(child);
  }, 0);
  node._total = node._posts + childrenTotal;
  return node._total;
}

export default Sidebar;
````


## `js/modules/filter.js`

````javascript
/**
 * js/modules/filter.js — 카테고리 & 태그 & 검색어 통합 필터
 *
 * 구독하는 이벤트:
 *   'posts:loaded'    → 전체 포스트 받아서 태그 칩 초기화
 *   'filter:category' → sidebar.js가 발행, 카테고리 필터 적용
 *   'filter:search'   → search.js가 발행, 검색어 필터 적용
 *
 * 발행하는 이벤트:
 *   'posts:filtered'  → { posts: Post[], query: string }
 *     → renderer.js가 posts로 카드 렌더링, query로 하이라이트
 *
 * 세 필터(카테고리 + 태그 + 검색어)는 AND 조건으로 합쳐집니다.
 * 즉, 모든 조건을 동시에 만족하는 포스트만 표시됩니다.
 *
 * 카테고리 계층 필터:
 *   'PC'     → category === 'PC' || category.startsWith('PC/')
 *   'all'    → 전체 통과
 */

import App from '../core/app.js';

const Filter = {
  /** 현재 필터 상태 */
  state: {
    category: 'all', // 선택된 카테고리 경로 또는 'all'
    tag:      'all', // 선택된 태그 또는 'all'
    query:    '',    // 검색어 (빈 문자열이면 전체)
    sort:     'newest', // 정렬 순서: 'newest' | 'oldest' | 'title'
  },

  _allPosts: [],

  /**
   * 초기화
   */
  init() {
    // 포스트 로드 → 태그 칩 생성 + 첫 렌더링
    App.on('posts:loaded', ({ posts }) => {
      this._allPosts = posts;
      this._renderTagChips();
      this._bindSortBtns();
      this._applyFilter();
    });

    // sidebar.js에서 카테고리 선택 수신
    App.on('filter:category', ({ category }) => {
      this.state.category = category;
      this._applyFilter();
    });

    // search.js에서 검색어 수신
    App.on('filter:search', ({ query }) => {
      this.state.query = query;
      this._updateResultInfo(); // 결과 수 즉시 업데이트
      this._applyFilter();
    });
  },

  /**
   * 태그 칩 버튼을 렌더링합니다.
   */
  _renderTagChips() {
    const container = document.getElementById('tagChips');
    if (!container) return;

    const allTags = ['all', ...new Set(this._allPosts.flatMap(p => p.tags || []))];

    const render = (filterText = '') => {
      const q = filterText.trim().toLowerCase();
      const visible = allTags.filter(t =>
        t === 'all' || !q || t.toLowerCase().includes(q)
      );
      container.innerHTML = visible.map(tag => `
        <button class="chip ${tag === this.state.tag ? 'active' : ''}"
                data-value="${tag}">
          ${tag === 'all' ? '전체' : '#' + tag}
        </button>
      `).join('');
    };

    render();

    // 태그 칩 클릭
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      this.state.tag = btn.dataset.value;
      this._applyFilter();
    });

    // 태그 검색 입력
    const tagSearch = document.getElementById('tagSearchInput');
    if (tagSearch) {
      tagSearch.addEventListener('input', () => {
        render(tagSearch.value);
        // 현재 선택된 태그 active 복원
        const active = container.querySelector(`[data-value="${this.state.tag}"]`);
        if (active) active.classList.add('active');
      });
    }
  },

  /**
   * 검색 결과 수 텍스트를 업데이트합니다.
   * HTML에 id="searchResultInfo" 요소가 있어야 합니다.
   *
   * @param {number} [count] - 결과 수 (생략 시 전체 포스트 수)
   */
  _updateResultInfo(count) {
    const el = document.getElementById('searchResultInfo');
    if (!el) return;

    const { query } = this.state;

    if (!query) {
      el.innerHTML = ''; // 검색어 없으면 안 보임
      return;
    }

    if (count === undefined) {
      // 필터 적용 전에 호출된 경우 (임시 표시)
      el.innerHTML = `<strong>"${escapeHtml(query)}"</strong> 검색 중...`;
    } else if (count === 0) {
      el.innerHTML = `<strong>"${escapeHtml(query)}"</strong> 검색 결과 없음`;
    } else {
      el.innerHTML = `<strong>"${escapeHtml(query)}"</strong> 검색 결과 <strong>${count}개</strong>`;
    }
  },

  /**
   * 정렬 버튼을 바인딩합니다.
   */
  _bindSortBtns() {
    const bar = document.getElementById('sortBar');
    if (!bar) return;
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.sort-btn');
      if (!btn) return;
      bar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.state.sort = btn.dataset.sort;
      this._applyFilter();
    });
  },

  /**
   * 현재 필터 상태(카테고리 + 태그 + 검색어)로 포스트를 걸러냅니다.
   * 세 조건을 모두 AND로 적용합니다.
   */
  _applyFilter() {
    const { category, tag, query, sort } = this.state;

    let filtered = this._allPosts.filter(post => {
      // ── 카테고리 필터 (계층 포함) ──
      let catOk;
      if (category === 'all') {
        catOk = true;
      } else {
        const postCat = post.category || '';
        catOk = postCat === category || postCat.startsWith(category + '/');
      }

      // ── 태그 필터 ──
      const tagOk = tag === 'all' || (post.tags || []).includes(tag);

      // ── 검색어 필터 ──
      const searchOk = !query || this._matchSearch(post, query);

      return catOk && tagOk && searchOk;
    });

    // ── 정렬 ──
    // 날짜 없는 포스트는 최신순 맨 뒤, 오래된순 맨 앞으로 처리
    const dateVal = (post, isNewest) => {
      const d = post.date ? new Date(post.date).getTime() : NaN;
      if (isNaN(d)) return isNewest ? -Infinity : Infinity;
      return d;
    };

    if (sort === 'newest') {
      filtered = [...filtered].sort((a, b) => {
        const diff = dateVal(b, true) - dateVal(a, true);
        if (diff !== 0) return diff;
        return (a.file || '').localeCompare(b.file || ''); // 날짜 같으면 파일명 순
      });
    } else if (sort === 'oldest') {
      filtered = [...filtered].sort((a, b) => {
        const diff = dateVal(a, false) - dateVal(b, false);
        if (diff !== 0) return diff;
        return (b.file || '').localeCompare(a.file || ''); // 날짜 같으면 파일명 역순
      });
    } else if (sort === 'title') {
      filtered = [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
    }

    // 결과 수 업데이트
    this._updateResultInfo(filtered.length);

    // renderer.js에 전달 (query도 함께 보내서 하이라이트에 활용)
    App.emit('posts:filtered', { posts: filtered, query });
  },

  /**
   * 포스트가 검색어와 일치하는지 확인합니다.
   *
   * 검색 방식:
   *   - 검색어를 공백으로 분리해서 여러 단어로 나눔
   *   - 제목 + 요약 + 카테고리 + 태그를 합친 텍스트에서
   *   - 모든 단어가 포함되면 매칭 (AND 검색)
   *   - 대소문자 구분 없음 (toLowerCase)
   *
   * 예: "javascript 입문" → '입문'과 'javascript'가 둘 다 있어야 함
   *
   * @param {Post}   post  - 검색 대상 포스트
   * @param {string} query - 검색어
   * @returns {boolean}
   */
  _matchSearch(post, query) {
    // 검색 대상 텍스트 합치기
    const searchText = [
      post.title    || '',
      post.excerpt  || '',
      post.category || '',
      ...(post.tags || []),
    ].join(' ').toLowerCase();

    // 검색어를 단어로 분리 (공백 기준, 빈 문자열 제거)
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    // 모든 단어가 텍스트 안에 있으면 매칭
    return words.every(word => searchText.includes(word));
  },
};

/**
 * HTML 특수문자를 이스케이프합니다. (XSS 방지)
 * 검색어를 innerHTML에 넣을 때 사용합니다.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default Filter;
````


## `js/modules/search.js`

````javascript
/**
 * js/modules/search.js — 실시간 검색 모듈
 *
 * 사용자가 검색어를 입력하면 'filter:search' 이벤트를 발행합니다.
 * filter.js가 이 이벤트를 받아서 카테고리/태그 필터와 함께 포스트를 걸러냅니다.
 *
 * 검색 범위: 제목, 요약(excerpt), 카테고리, 태그
 *
 * 발행하는 이벤트:
 *   'filter:search' → { query: string }
 *
 * HTML에 필요한 요소:
 *   #searchInput  - 텍스트 입력
 *   #searchClear  - X 지우기 버튼
 */

import App from '../core/app.js';

const Search = {
  /**
   * 초기화: 검색 입력 이벤트 연결
   * App.register('search', Search) 시 자동 호출됩니다.
   */
  init() {
    const input    = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');
    if (!input) return;

    /**
     * 디바운스 타이머 ID.
     * 타이핑이 멈추고 200ms 후에 검색을 실행합니다.
     * (키를 누를 때마다 즉시 실행하면 너무 자주 필터링됨)
     */
    let debounce = null;

    /**
     * 숨은 명령어: 검색창에 이 단어를 그대로 입력하면
     * 글쓰기(에디터) 페이지로 이동합니다.
     * 헤더에 눈에 띄는 글쓰기 버튼을 두지 않으려는 용도라
     * 방문자는 모르고, 작성자만 아는 진입점 역할을 합니다.
     */
    const EDITOR_COMMAND = '글쓰기';

    // ── 입력 이벤트 ──
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const query = input.value.trim();

        // 숨은 명령어 감지 → 에디터로 이동 (검색은 실행하지 않음)
        if (query === EDITOR_COMMAND) {
          input.value = '';
          if (clearBtn) clearBtn.style.display = 'none';
          window.location.href = 'editor.html';
          return;
        }

        // X 버튼 표시/숨김
        if (clearBtn) {
          clearBtn.style.display = query ? 'flex' : 'none';
        }

        // 검색 이벤트 발행
        App.emit('filter:search', { query });
      }, 200);
    });

    // ── X 지우기 버튼 ──
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        App.emit('filter:search', { query: '' });
        input.focus(); // 지운 후 바로 다시 입력할 수 있도록 포커스
      });
    }

    // ── Escape 키로 검색 초기화 ──
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        App.emit('filter:search', { query: '' });
        input.blur(); // 포커스 해제
      }
    });

    // ── 헤더의 🔍 단축키: '/' 키를 누르면 검색창 포커스 ──
    // (입력 중일 때는 동작하지 않도록 조건 추가)
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
      if (e.key === '/' && !isTyping) {
        e.preventDefault(); // 브라우저 기본 동작 방지
        input.focus();
        input.select();
      }
    });
  },
};

export default Search;
````


## `js/modules/renderer.js`

````javascript
/**
 * js/modules/renderer.js — 포스트 카드 렌더러
 *
 * 'posts:filtered' 이벤트를 받아서 카드 목록을 DOM에 그립니다.
 *
 * ── SPA 라우터 연동 ──
 *   카드에 data-file 속성을 부여합니다.
 *   router.js가 문서 전체에 걸어둔 클릭 이벤트 위임이
 *   .post-card[data-file] 클릭을 감지해서 Router.goPost(file)을 호출합니다.
 *   → 페이지 이동 없이 콘텐츠만 교체 → 음악이 끊기지 않습니다.
 *
 *   href는 post.html?file=... 로 유지하여 JS 비활성 환경의 폴백을 지원합니다.
 *
 * 구독하는 이벤트:
 *   'posts:filtered' → { posts: Post[], query: string }
 */

import App from '../core/app.js';

const Renderer = {
  init() {
    App.on('posts:filtered', ({ posts, query = '' }) => {
      this.render(posts, query);
    });
  },

  /**
   * @param {Post[]} posts
   * @param {string} query - 검색어 (하이라이트용)
   */
  render(posts, query = '') {
    const grid = document.getElementById('postsGrid');
    if (!grid) return;

    if (posts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${query ? '🔍' : '📭'}</div>
          <p>${query
            ? `<strong>"${escapeHtml(query)}"</strong>에 대한 결과가 없어요.`
            : '해당하는 포스트가 없어요.'
          }</p>
        </div>`;
      return;
    }

    grid.innerHTML = posts.map(post => this._cardHTML(post, query)).join('');
  },

  /**
   * 포스트 하나를 카드 HTML로 변환합니다.
   *
   * ★ data-file 속성이 SPA 라우터의 핵심입니다.
   *   router.js가 .post-card[data-file] 클릭을 가로채서
   *   페이지 이동 없이 포스트 뷰를 렌더링합니다.
   *
   * @param {Post}   post
   * @param {string} query - 검색어
   */
  _cardHTML(post, query) {
    // post.html?file=... 는 JS 비활성 환경의 폴백 href
    const href    = `post.html?file=${encodeURIComponent(post.file)}`;
    const title   = query ? highlight(escapeHtml(post.title   || ''), query) : escapeHtml(post.title   || '');
    const excerpt = query ? highlight(escapeHtml(post.excerpt || ''), query) : escapeHtml(post.excerpt || '');

    const categoryBadge = post.category
      ? `<span class="post-category">${escapeHtml(post.category)}</span>`
      : '';

    const tagsHTML = (post.tags || [])
      .map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`)
      .join('');

    return `
      <a class="post-card"
         href="${href}"
         data-file="${escapeHtml(post.file)}">
        ${categoryBadge}
        <h2 class="post-card-title">${title}</h2>
        <p class="post-card-excerpt">${excerpt}</p>
        <div class="post-card-meta">
          <span class="post-date">${formatDate(post.date)}</span>
          <div class="post-tags">${tagsHTML}</div>
        </div>
      </a>
    `;
  },
};

/**
 * 검색어를 <mark>로 하이라이트합니다.
 * @param {string} text  - 이미 이스케이프된 텍스트
 * @param {string} query - 검색어
 */
function highlight(text, query) {
  if (!query) return text;
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return text;
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return text.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

/** HTML 특수문자 이스케이프 (XSS 방지) */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** 'YYYY-MM-DD' → '2024년 1월 15일' */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default Renderer;
````


## `js/modules/markdown.js`

````javascript
/**
 * js/modules/markdown.js — 마크다운 파서
 *
 * marked.js(CDN)를 래핑합니다.
 * marked.js가 로드되지 않은 경우 에러 메시지를 반환합니다.
 *
 * 사용법:
 *   import Markdown from './markdown.js';
 *   const html = Markdown.parse('# 제목\n본문...');
 *   const { meta, content } = Markdown.parseFrontMatter(rawText);
 */

const Markdown = {
  /**
   * 마크다운 텍스트를 HTML 문자열로 변환합니다.
   * CDN으로 불러온 window.marked를 사용합니다.
   *
   * @param {string} mdText - 마크다운 텍스트
   * @returns {string}      - 변환된 HTML
   */
  parse(mdText) {
    if (typeof window.marked === 'undefined') {
      console.error('[Markdown] marked.js가 로드되지 않았습니다.');
      return `<p>마크다운 파서를 불러올 수 없습니다.</p>`;
    }
    return window.marked.parse(mdText);
  },

  /**
   * 마크다운 파일 맨 위의 Front Matter를 파싱합니다.
   *
   * Front Matter란?
   *   ---로 감싼 영역에 제목, 날짜, 태그 등 메타데이터를 넣는 형식입니다.
   *   예:
   *     ---
   *     title: 내 첫 글
   *     date: 2024-01-15
   *     tags: [JS, CSS]
   *     ---
   *     # 본문 시작
   *
   * @param {string} raw - .md 파일 전체 텍스트
   * @returns {{ meta: Object, content: string }}
   *   - meta:    파싱된 메타데이터 (title, date, category, tags 등)
   *   - content: Front Matter를 제외한 순수 마크다운 본문
   */
  parseFrontMatter(raw) {
    const meta = {};

    // 파일이 ---\n으로 시작하는지 확인 (Front Matter 없으면 그대로 반환)
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta, content: raw };

    // Front Matter 파싱: 줄 단위로 "키: 값" 처리
    match[1].split('\n').forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return; // ':' 없는 줄은 건너뜀

      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();

      if (key === 'tags') {
        // 태그는 배열로 파싱: [JS, CSS] 또는 JS, CSS 형식 모두 지원
        meta.tags = val
          .replace(/[\[\]]/g, '')      // 대괄호 제거
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);            // 빈 문자열 제거
      } else {
        meta[key] = val;
      }
    });

    return { meta, content: match[2] };
  },
};

// marked.js 옵션 설정 (window.marked가 있을 때만)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if (window.marked) {
      window.marked.setOptions({
        gfm:    true, // GitHub Flavored Markdown (표, 취소선 등 지원)
        breaks: true, // \n을 <br>로 변환
      });
    }
  });
}

export default Markdown;
````


## `js/modules/toc.js`

````javascript
/**
 * js/modules/toc.js — 목차(Table of Contents) 생성 & 스크롤 감지
 *
 * ── 하이라이트 알고리즘 ──
 * IntersectionObserver는 heading이 "화면에 들어올 때"만 감지하기 때문에
 * 섹션이 길 경우 heading이 위로 사라진 뒤 하이라이트가 꺼지는 문제가 있습니다.
 *
 * 대신 scroll 이벤트를 사용합니다:
 *   → 현재 스크롤 위치에서 "이미 지나친" heading 중 가장 마지막 것 = 현재 섹션
 *   → 클릭 시에도 즉시 active 반영
 */

const Toc = {
  /** requestAnimationFrame ID (스크롤 이벤트 최적화용) */
  _rafId: null,

  /** 스크롤 이벤트 리스너 참조 (cleanup 시 제거용) */
  _scrollHandler: null,

  /** 현재 페이지의 heading 목록 */
  _headings: [],

  /**
   * 목차를 생성합니다.
   * 이전 목차가 있으면 먼저 정리(cleanup)한 뒤 새로 만듭니다.
   *
   * @param {Object} options
   * @param {string} options.bodyId    - 본문 컨테이너 id (기본: 'postBody')
   * @param {string} options.tocId     - 목차 리스트 id (기본: 'tocList')
   * @param {string} options.sidebarId - 목차 사이드바 id (기본: 'tocSidebar')
   */
  build({ bodyId = 'postBody', tocId = 'tocList', sidebarId = 'tocSidebar' } = {}) {
    this._cleanup();

    const body    = document.getElementById(bodyId);
    const tocList = document.getElementById(tocId);
    const sidebar = document.getElementById(sidebarId);
    if (!body || !tocList || !sidebar) return;

    // h2, h3, h4만 목차에 포함 (h1은 포스트 제목으로 사용)
    const headings = Array.from(body.querySelectorAll('h2, h3, h4'));

    if (headings.length === 0) {
      sidebar.style.display = 'none';
      return;
    }

    sidebar.style.display = '';
    tocList.innerHTML = '';

    // ── heading마다 id 부여 + 목차 항목 생성 ──
    headings.forEach((heading, idx) => {
      // id: 인덱스 + 텍스트(소문자화, 특수문자 제거, 공백→하이픈)
      const id = `h-${idx}-` + heading.textContent
        .toLowerCase()
        .replace(/[^\w\s가-힣]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 40);

      heading.id = id;

      const level = parseInt(heading.tagName[1]); // 2, 3, 또는 4
      const li = document.createElement('li');
      li.className = `toc-item level-${level}`;

      const a = document.createElement('a');
      a.href = `#${id}`;
      a.textContent = heading.textContent;

      // ── 클릭: 즉시 active 설정 + 부드럽게 스크롤 ──
      a.addEventListener('click', (e) => {
        e.preventDefault();

        // Observer 응답을 기다리지 않고 즉시 하이라이트
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

    // ── 스크롤 이벤트로 현재 섹션 감지 ──
    this._scrollHandler = () => {
      // requestAnimationFrame: 스크롤 이벤트가 너무 자주 발생하면
      // 프레임당 한 번만 실행되도록 제한 (성능 최적화)
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = requestAnimationFrame(() => {
        this._updateActive(tocList);
      });
    };

    window.addEventListener('scroll', this._scrollHandler, { passive: true });

    // 페이지 첫 로드 시 초기 상태 반영 (스크롤 없이도 하이라이트)
    this._updateActive(tocList);
  },

  /**
   * 현재 스크롤 위치 기준으로 active heading을 계산합니다. (내부 메서드)
   *
   * 알고리즘:
   *   헤더 높이 + 여유 16px 아래 기준선을 정하고,
   *   기준선보다 위에 있는(= 이미 지나친) heading 중 가장 마지막 것을 active로 봅니다.
   *   → 어떤 섹션 안에 있든 그 섹션의 heading이 항상 하이라이트됩니다.
   *
   * @param {HTMLElement} tocList - 목차 ul 요소
   */
  _updateActive(tocList) {
    if (!this._headings.length) return;

    // 헤더 높이 (CSS 변수에서 읽거나 60px로 폴백)
    const headerHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '60'
    );

    // 판정 기준선을 화면 맨 위가 아니라 "읽는 지점"(헤더 아래 영역의 약 40% 지점)에 둡니다.
    // → 화면 위쪽 끝이 아니라, 지금 화면을 채우고 있는 섹션이 하이라이트됩니다.
    //   (섹션 5처럼 아래쪽이 긴 경우에도 자연스럽게 따라옴)
    const READING_RATIO = 0.4;
    const readingLine = window.scrollY + headerHeight
                      + (window.innerHeight - headerHeight) * READING_RATIO;

    // 기준선을 지나친 heading 중 가장 아래 것(= 현재 섹션)
    let activeId = null;
    for (const heading of this._headings) {
      if (heading.offsetTop <= readingLine) {
        activeId = heading.id;
      } else {
        break; // heading들이 위→아래 순서이므로 넘으면 더 볼 필요 없음
      }
    }

    // 페이지 끝까지 스크롤했으면 마지막 섹션을 활성화
    // (짧은 마지막 섹션은 heading이 기준선까지 못 올라와 하이라이트가 안 되는 문제 보정)
    const atBottom = window.innerHeight + window.scrollY
                   >= document.documentElement.scrollHeight - 2;
    if (atBottom) {
      activeId = this._headings[this._headings.length - 1].id;
    }

    // 아직 첫 섹션 기준선에도 못 미쳤으면 첫 섹션을 활성화
    if (!activeId) activeId = this._headings[0].id;

    this._setActive(tocList, activeId);
  },

  /**
   * 특정 id에 해당하는 목차 링크를 active로 설정합니다. (내부 메서드)
   * 기존 active는 모두 제거하고 해당 링크만 활성화합니다.
   *
   * @param {HTMLElement} tocList - 목차 ul 요소
   * @param {string}      id      - 활성화할 heading의 id
   */
  _setActive(tocList, id) {
    tocList.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
    const link = tocList.querySelector(`a[href="#${id}"]`);
    if (link) {
      link.classList.add('active');

      // ToC 사이드바 안에서도 active 항목이 보이도록 스크롤
      link.scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * 이벤트 리스너와 RAF를 해제합니다. (내부 메서드)
   * 포스트를 재로드할 때 메모리 누수 방지용
   */
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
````


## `js/modules/post-enhance.js`

````javascript
/**
 * js/modules/post-enhance.js — 렌더된 포스트 본문 후처리
 *
 * 마크다운 → HTML 변환 후(Markdown.parse), 본문 DOM에 두 가지를 입힙니다.
 *
 *   1) 코드 블록 하이라이팅 (노션 스타일)
 *      - highlight.js(CDN, window.hljs)로 문법 색 입힘
 *      - 코드블록 위에 헤더바(언어 라벨 + 복사 버튼) 추가
 *      - 색상은 css/code.css에서 라이트/다크 테마 변수로 정의됨
 *
 *   2) 헤더 토글 (접기/펼치기)
 *      - h2/h3/h4를 클릭하면 그 아래 내용(다음 헤더 전까지)이 접히고 펼쳐짐
 *      - 헤더 왼쪽에 ▾ 셰브론이 붙고, 접힌 상태면 회전
 *
 * 사용법:
 *   import PostEnhance from './modules/post-enhance.js';
 *   PostEnhance.apply(document.getElementById('postBody'));
 *
 * 주의:
 *   - Toc.build() 이후에 호출해도 heading의 id는 그대로 유지됩니다
 *     (헤더 요소 자체는 건드리지 않고, 뒤따르는 내용만 래핑하므로).
 *   - highlight.js가 없으면(로드 실패) 하이라이팅은 조용히 건너뜁니다.
 */

const PostEnhance = {
  /**
   * 본문 컨테이너에 하이라이팅 + 헤더 토글을 적용합니다.
   * @param {HTMLElement} bodyEl - 포스트 본문 요소 (#postBody)
   */
  apply(bodyEl) {
    if (!bodyEl) return;
    this._highlightCode(bodyEl);
    this._makeCollapsibleHeaders(bodyEl);
  },

  // ══════════════════════════════════════════════════════
  // [1] 코드 블록 하이라이팅 + 노션식 헤더바
  // ══════════════════════════════════════════════════════

  _highlightCode(bodyEl) {
    const blocks = bodyEl.querySelectorAll('pre code');

    blocks.forEach(code => {
      const pre = code.closest('pre');
      if (!pre || pre.parentElement.classList.contains('code-block')) return; // 중복 처리 방지

      // 언어 감지: marked가 붙인 language-xxx 클래스에서 추출
      const langClass = [...code.classList].find(c => c.startsWith('language-'));
      const lang = langClass ? langClass.replace('language-', '') : '';

      // highlight.js 적용 (없으면 건너뜀 → 색 없는 코드로 표시)
      if (window.hljs) {
        try { window.hljs.highlightElement(code); } catch (_) { /* noop */ }
      }

      // ── 노션식 래핑: .code-block > (.code-block-head + pre) ──
      const block = document.createElement('div');
      block.className = 'code-block';
      pre.replaceWith(block);

      const head = document.createElement('div');
      head.className = 'code-block-head';

      const label = document.createElement('span');
      label.className = 'code-lang';
      label.textContent = (lang || 'code').toUpperCase();

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy';
      copyBtn.type = 'button';
      copyBtn.textContent = '복사';
      copyBtn.addEventListener('click', () => this._copy(code.textContent, copyBtn));

      head.append(label, copyBtn);
      block.append(head, pre);
    });
  },

  /**
   * 클립보드 복사. clipboard API 실패 시(file:// 등) execCommand로 폴백.
   */
  _copy(text, btn) {
    const done = () => {
      const orig = '복사';
      btn.textContent = '복사됨!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this._copyFallback(text, done));
    } else {
      this._copyFallback(text, done);
    }
  },

  _copyFallback(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (_) { /* noop */ }
    document.body.removeChild(ta);
  },

  // ══════════════════════════════════════════════════════
  // [2] 헤더 토글 (접기/펼치기)
  // ══════════════════════════════════════════════════════

  _makeCollapsibleHeaders(bodyEl) {
    const headers = bodyEl.querySelectorAll('h2, h3, h4');

    headers.forEach(header => {
      // 이 헤더 다음부터 "다음 헤더(h1~h4) 직전"까지의 형제 요소를 모읍니다.
      const content = [];
      let sib = header.nextElementSibling;
      while (sib && !/^H[1-4]$/.test(sib.tagName)) {
        content.push(sib);
        sib = sib.nextElementSibling;
      }

      // 접을 내용을 감쌀 래퍼를 헤더 바로 뒤에 삽입하고 내용을 이동
      const wrapper = document.createElement('div');
      wrapper.className = 'toggle-content';
      header.after(wrapper);
      content.forEach(el => wrapper.appendChild(el));

      header.classList.add('toggle-header');

      // 클릭 → 접기/펼치기 토글
      header.addEventListener('click', () => {
        const collapsed = header.classList.toggle('collapsed');
        wrapper.classList.toggle('collapsed', collapsed);
      });
    });
  },
};

export default PostEnhance;
````


## `js/modules/music-player.js`

````javascript
/**
 * js/modules/music-player.js — 하단 고정 뮤직 플레이어
 *
 * 기능:
 *   - music/playlist.json에서 플레이리스트 로드
 *   - 로컬 파일(music/*.mp3)과 외부 URL 모두 지원
 *   - 재생/일시정지/이전/다음/볼륨/셔플/반복
 *   - 플레이리스트 패널 슬라이드
 *   - 페이지 이동 시 현재 곡 + 재생 위치 저장 → 다음 페이지에서 복원
 *   - 초기 상태: 자동 정지 (사용자가 직접 재생 버튼 눌러야 함)
 *
 * App 이벤트:
 *   발행: 없음 (독립 모듈)
 *   구독: 없음 (독립 모듈)
 */

import Storage from '../core/storage.js';

// localStorage 키
const SK = {
  INDEX:    'mp_index',   // 현재 곡 인덱스
  TIME:     'mp_time',    // 재생 위치 (초)
  VOLUME:   'mp_volume',  // 볼륨 (0~1)
  SHUFFLE:  'mp_shuffle', // 셔플 켜짐 여부
  REPEAT:   'mp_repeat',  // 반복 모드 ('none'|'one'|'all')
};

const MusicPlayer = {
  // ── 상태 ──
  audio:        null,    // HTMLAudioElement
  playlist:     [],      // 전체 곡 목록 (playlist.json)
  currentIndex: 0,       // 현재 곡 인덱스
  isPlaying:    false,
  isShuffled:   false,
  repeatMode:   'none',  // 'none' | 'one' | 'all'
  shuffleOrder: [],      // 셔플 시 재생 순서 배열

  // ── DOM 요소 참조 ──
  el: {},

  /**
   * 초기화: playlist.json 로드 → DOM 생성 → 상태 복원 → 이벤트 연결
   * App.register('music', MusicPlayer) 시 자동 호출됩니다.
   */
  async init() {
    try {
      const res = await fetch('music/playlist.json');
      if (!res.ok) throw new Error('playlist.json not found');
      this.playlist = await res.json();
    } catch {
      // playlist.json이 없거나 비어있으면 플레이어를 렌더링하되 "목록 없음" 표시
      this.playlist = [];
    }

    this._buildDOM();    // HTML 구조 생성
    this._bindEvents();  // 버튼/슬라이더 이벤트 연결
    this._restoreState();// localStorage에서 이전 상태 복원
    this._renderPlaylist();
    this._updateTrackInfo();
    this._updateControls();

    // 페이지 떠나기 전에 현재 상태 저장
    window.addEventListener('beforeunload', () => this._saveState());
  },

  // ══════════════════════════════════════════════════════
  // [1] DOM 생성
  // ══════════════════════════════════════════════════════

  /**
   * 플레이어 HTML을 body에 직접 삽입합니다.
   * 어떤 페이지에서든 동일하게 동작합니다.
   */
  _buildDOM() {
    const div = document.createElement('div');
    div.id = 'musicPlayer';
    div.className = 'music-player';
    div.innerHTML = `
      <!-- 플레이리스트 패널 (위로 슬라이드) -->
      <div class="playlist-panel" id="playlistPanel">
        <div class="playlist-header">
          <span>재생목록 <span id="playlistCount"></span></span>
          <button id="playlistCloseBtn" title="닫기">✕</button>
        </div>
        <ul class="playlist-items" id="playlistItems"></ul>
      </div>

      <!-- 플레이어 바 -->
      <div class="player-bar">

        <!-- 왼쪽: 트랙 정보 -->
        <div class="player-track">
          <div class="track-cover" id="trackCover">♫</div>
          <div class="track-info">
            <div class="track-title"  id="trackTitle">재생목록을 추가하세요</div>
            <div class="track-artist" id="trackArtist">music/playlist.json</div>
          </div>
        </div>

        <!-- 가운데: 재생 버튼 + 프로그레스 -->
        <div class="player-center">
          <div class="player-controls">
            <button class="ctrl-btn" id="mpPrevBtn"  title="이전 곡">⏮</button>
            <button class="ctrl-btn play-btn" id="mpPlayBtn" title="재생/일시정지">▶</button>
            <button class="ctrl-btn" id="mpNextBtn"  title="다음 곡">⏭</button>
          </div>
          <div class="player-progress">
            <span class="time" id="mpCurrentTime">0:00</span>
            <input type="range" class="progress-slider" id="mpProgress" min="0" value="0" step="0.1" />
            <span class="time" id="mpDuration">0:00</span>
          </div>
        </div>

        <!-- 오른쪽: 셔플/반복/볼륨/목록 -->
        <div class="player-extra">
          <button class="ctrl-btn" id="mpShuffleBtn" title="셔플">🔀</button>
          <button class="ctrl-btn" id="mpRepeatBtn"  title="반복">🔁</button>
          <div class="volume-wrap">
            <button class="ctrl-btn" id="mpMuteBtn" title="음소거">🔊</button>
            <input type="range" class="volume-slider" id="mpVolume" min="0" max="100" value="70" />
          </div>
          <button class="ctrl-btn" id="mpListBtn" title="재생목록">☰</button>
        </div>

      </div>
    `;

    document.body.appendChild(div);
    document.body.classList.add('has-player'); // 본문 하단 여백 추가

    // DOM 요소 참조 저장 (매번 querySelector 하지 않도록)
    this.el = {
      panel:       document.getElementById('playlistPanel'),
      items:       document.getElementById('playlistItems'),
      count:       document.getElementById('playlistCount'),
      cover:       document.getElementById('trackCover'),
      title:       document.getElementById('trackTitle'),
      artist:      document.getElementById('trackArtist'),
      playBtn:     document.getElementById('mpPlayBtn'),
      prevBtn:     document.getElementById('mpPrevBtn'),
      nextBtn:     document.getElementById('mpNextBtn'),
      progress:    document.getElementById('mpProgress'),
      currentTime: document.getElementById('mpCurrentTime'),
      duration:    document.getElementById('mpDuration'),
      shuffleBtn:  document.getElementById('mpShuffleBtn'),
      repeatBtn:   document.getElementById('mpRepeatBtn'),
      muteBtn:     document.getElementById('mpMuteBtn'),
      volume:      document.getElementById('mpVolume'),
      listBtn:     document.getElementById('mpListBtn'),
      closeBtn:    document.getElementById('playlistCloseBtn'),
    };

    // Audio 엘리먼트 생성 (보이지 않는 오디오 플레이어)
    this.audio = new Audio();
    this.audio.preload = 'metadata'; // 재생 전에 메타데이터(길이 등)만 미리 로드
  },

  // ══════════════════════════════════════════════════════
  // [2] 이벤트 연결
  // ══════════════════════════════════════════════════════

  _bindEvents() {
    const { el, audio } = this;

    // ── 재생 컨트롤 ──
    el.playBtn.addEventListener('click', () => this._togglePlay());
    el.prevBtn.addEventListener('click', () => this._prev());
    el.nextBtn.addEventListener('click', () => this._next());

    // ── 프로그레스 슬라이더 ──
    // 드래그 중에는 오디오 업데이트를 멈추고, 드래그 끝나면 이동
    let seeking = false;
    el.progress.addEventListener('mousedown',  () => { seeking = true; });
    el.progress.addEventListener('touchstart', () => { seeking = true; });
    el.progress.addEventListener('change', () => {
      audio.currentTime = parseFloat(el.progress.value);
      seeking = false;
    });
    el.progress.addEventListener('input', () => {
      // 슬라이더 색상 채우기
      this._updateSliderFill(el.progress);
      el.currentTime.textContent = formatTime(parseFloat(el.progress.value));
    });

    // ── 오디오 시간 업데이트 ──
    audio.addEventListener('timeupdate', () => {
      if (!seeking && !isNaN(audio.duration)) {
        const pct = (audio.currentTime / audio.duration) * 100;
        el.progress.value = audio.currentTime;
        el.currentTime.textContent = formatTime(audio.currentTime);
        this._updateSliderFill(el.progress, pct);
      }
    });

    // ── 오디오 메타데이터 로드 (duration 파악) ──
    audio.addEventListener('loadedmetadata', () => {
      el.progress.max = audio.duration;
      el.duration.textContent = formatTime(audio.duration);
      // 복원된 시간이 있으면 적용
      const savedTime = Storage.get(SK.TIME, 0);
      if (savedTime > 0) {
        audio.currentTime = savedTime;
        Storage.remove(SK.TIME); // 한 번 복원하면 삭제
      }
    });

    // ── 곡 끝나면 다음 곡 ──
    audio.addEventListener('ended', () => this._onEnded());

    // ── 볼륨 슬라이더 ──
    el.volume.addEventListener('input', () => {
      const vol = parseInt(el.volume.value) / 100;
      audio.volume = vol;
      Storage.set(SK.VOLUME, vol);
      this._updateSliderFill(el.volume);
      el.muteBtn.textContent = vol === 0 ? '🔇' : '🔊';
    });

    // ── 음소거 버튼 ──
    el.muteBtn.addEventListener('click', () => {
      if (audio.volume > 0) {
        this._prevVolume = audio.volume; // 이전 볼륨 저장
        audio.volume = 0;
        el.volume.value = 0;
        el.muteBtn.textContent = '🔇';
      } else {
        // 음소거 해제: 이전 볼륨으로 복원
        const restore = this._prevVolume || 0.7;
        audio.volume = restore;
        el.volume.value = restore * 100;
        el.muteBtn.textContent = '🔊';
      }
      this._updateSliderFill(el.volume);
    });

    // ── 셔플 버튼 ──
    el.shuffleBtn.addEventListener('click', () => {
      this.isShuffled = !this.isShuffled;
      if (this.isShuffled) this._buildShuffleOrder();
      el.shuffleBtn.classList.toggle('on', this.isShuffled);
      Storage.set(SK.SHUFFLE, this.isShuffled);
    });

    // ── 반복 버튼 ──
    // none → one → all → none 순으로 순환
    el.repeatBtn.addEventListener('click', () => {
      const modes = ['none', 'one', 'all'];
      const next  = modes[(modes.indexOf(this.repeatMode) + 1) % modes.length];
      this.repeatMode = next;
      Storage.set(SK.REPEAT, next);
      this._updateRepeatBtn();
    });

    // ── 플레이리스트 버튼 ──
    el.listBtn.addEventListener('click', () => {
      el.panel.classList.toggle('open');
    });
    el.closeBtn.addEventListener('click', () => {
      el.panel.classList.remove('open');
    });
  },

  // ══════════════════════════════════════════════════════
  // [3] 재생 제어
  // ══════════════════════════════════════════════════════

  /**
   * 재생/일시정지 토글
   */
  _togglePlay() {
    if (this.playlist.length === 0) return;
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      // audio.src가 비어있으면 현재 곡 먼저 로드
      if (!this.audio.src || this.audio.src === window.location.href) {
        this._loadTrack(this.currentIndex, false);
      }
      this.audio.play().catch(err => console.warn('[MusicPlayer] 재생 실패:', err));
      this.isPlaying = true;
    }
    this._updatePlayBtn();
  },

  /**
   * 특정 인덱스의 곡을 로드합니다.
   *
   * @param {number}  index    - 플레이리스트 인덱스
   * @param {boolean} autoPlay - true면 로드 후 즉시 재생
   */
  _loadTrack(index, autoPlay = true) {
    if (this.playlist.length === 0) return;

    // 인덱스 범위 보정
    this.currentIndex = ((index % this.playlist.length) + this.playlist.length) % this.playlist.length;
    const track = this.playlist[this.currentIndex];

    // src 경로 처리: 외부 URL이면 그대로, 로컬 파일이면 경로 그대로 사용
    const rawSrc = track.file || track.src || '';
    const src = rawSrc.startsWith('http') ? rawSrc : rawSrc;
    this.audio.src = src;
    this.audio.load();

    Storage.set(SK.INDEX, this.currentIndex);

    this._updateTrackInfo();
    this._updatePlaylistHighlight();
    this._resetProgress();

    if (autoPlay) {
      this.audio.play()
        .then(() => { this.isPlaying = true; this._updatePlayBtn(); })
        .catch(err => console.warn('[MusicPlayer] 재생 실패:', err));
    }
  },

  /**
   * 이전 곡으로 이동
   * - 재생 시작 후 3초 이내면 이전 곡으로 이동
   * - 3초 이후면 현재 곡을 처음부터 재생
   */
  _prev() {
    if (this.playlist.length === 0) return;
    if (this.audio.currentTime > 3) {
      // 현재 곡 처음으로
      this.audio.currentTime = 0;
      return;
    }
    const nextIdx = this._getPrevIndex();
    this._loadTrack(nextIdx, this.isPlaying);
  },

  /**
   * 다음 곡으로 이동
   */
  _next() {
    if (this.playlist.length === 0) return;
    const nextIdx = this._getNextIndex();
    this._loadTrack(nextIdx, this.isPlaying);
  },

  /**
   * 곡이 끝났을 때 처리
   */
  _onEnded() {
    switch (this.repeatMode) {
      case 'one':
        // 한 곡 반복: 현재 곡 처음부터
        this.audio.currentTime = 0;
        this.audio.play();
        break;
      case 'all':
        // 전체 반복: 다음 곡 (마지막이면 첫 번째로)
        this._loadTrack(this._getNextIndex(), true);
        break;
      default:
        // 반복 없음: 마지막 곡이면 정지, 아니면 다음 곡
        const nextIdx = this._getNextIndex();
        if (nextIdx === 0 && !this.isShuffled) {
          // 마지막 곡 끝 → 정지
          this.isPlaying = false;
          this._updatePlayBtn();
          this._resetProgress();
        } else {
          this._loadTrack(nextIdx, true);
        }
    }
  },

  // ══════════════════════════════════════════════════════
  // [4] 셔플 & 반복
  // ══════════════════════════════════════════════════════

  /**
   * 셔플 순서 배열을 생성합니다.
   * Fisher-Yates 알고리즘으로 무작위 순서 생성.
   */
  _buildShuffleOrder() {
    const arr = Array.from({ length: this.playlist.length }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]; // 두 값 교환
    }
    // 현재 곡을 맨 앞으로 이동
    const curPos = arr.indexOf(this.currentIndex);
    if (curPos !== 0) {
      [arr[0], arr[curPos]] = [arr[curPos], arr[0]];
    }
    this.shuffleOrder = arr;
  },

  /**
   * 다음 곡 인덱스를 반환합니다. (셔플 고려)
   * @returns {number}
   */
  _getNextIndex() {
    if (this.isShuffled) {
      const pos = this.shuffleOrder.indexOf(this.currentIndex);
      return this.shuffleOrder[(pos + 1) % this.shuffleOrder.length];
    }
    return (this.currentIndex + 1) % this.playlist.length;
  },

  /**
   * 이전 곡 인덱스를 반환합니다. (셔플 고려)
   * @returns {number}
   */
  _getPrevIndex() {
    if (this.isShuffled) {
      const pos = this.shuffleOrder.indexOf(this.currentIndex);
      return this.shuffleOrder[(pos - 1 + this.shuffleOrder.length) % this.shuffleOrder.length];
    }
    return (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
  },

  // ══════════════════════════════════════════════════════
  // [5] UI 업데이트
  // ══════════════════════════════════════════════════════

  /**
   * 현재 곡의 제목/아티스트/커버를 표시합니다.
   */
  _updateTrackInfo() {
    const track = this.playlist[this.currentIndex];
    if (!track) return;

    this.el.title.textContent  = track.title  || '제목 없음';
    this.el.artist.textContent = track.artist || '';

    if (track.cover) {
      this.el.cover.innerHTML = `<img src="${track.cover}" alt="${track.title}" />`;
    } else {
      this.el.cover.textContent = '♫';
    }
  },

  /**
   * 재생/일시정지 버튼 아이콘을 업데이트합니다.
   */
  _updatePlayBtn() {
    this.el.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
  },

  /**
   * 반복 버튼 아이콘/상태를 업데이트합니다.
   * none: 흐림, one: 🔂 + 활성, all: 🔁 + 활성
   */
  _updateRepeatBtn() {
    const { repeatBtn } = this.el;
    const icons = { none: '🔁', one: '🔂', all: '🔁' };
    repeatBtn.textContent = icons[this.repeatMode];
    repeatBtn.classList.toggle('on', this.repeatMode !== 'none');
    repeatBtn.title = { none: '반복 없음', one: '한 곡 반복', all: '전체 반복' }[this.repeatMode];
  },

  /**
   * 컨트롤 초기 상태를 업데이트합니다. (상태 복원 후 호출)
   */
  _updateControls() {
    this._updatePlayBtn();
    this._updateRepeatBtn();
    this.el.shuffleBtn.classList.toggle('on', this.isShuffled);

    const vol = this.audio.volume;
    this.el.volume.value = vol * 100;
    this._updateSliderFill(this.el.volume);
    this.el.muteBtn.textContent = vol === 0 ? '🔇' : '🔊';
  },

  /**
   * 플레이리스트 목록을 렌더링합니다.
   */
  _renderPlaylist() {
    const { items, count } = this.el;
    count.textContent = `(${this.playlist.length})`;

    if (this.playlist.length === 0) {
      items.innerHTML = `
        <li class="playlist-empty">
          music/playlist.json에 곡을 추가하세요.<br>
          로컬 파일(.mp3)과 외부 URL 모두 지원합니다.
        </li>`;
      return;
    }

    items.innerHTML = this.playlist.map((track, idx) => `
      <li class="playlist-item ${idx === this.currentIndex ? 'active' : ''}"
          data-index="${idx}">
        <span class="playlist-num">${idx + 1}</span>
        <div class="playlist-track-info">
          <div class="playlist-track-title">${track.title || '제목 없음'}</div>
          <div class="playlist-track-artist">${track.artist || ''}</div>
        </div>
      </li>
    `).join('');

    // 클릭 이벤트 (이벤트 위임)
    items.addEventListener('click', (e) => {
      const li = e.target.closest('.playlist-item');
      if (!li) return;
      const idx = parseInt(li.dataset.index);
      this._loadTrack(idx, true);
      this.isPlaying = true;
      this._updatePlayBtn();
    });
  },

  /**
   * 플레이리스트에서 현재 곡을 강조합니다.
   */
  _updatePlaylistHighlight() {
    this.el.items.querySelectorAll('.playlist-item').forEach((li, idx) => {
      li.classList.toggle('active', idx === this.currentIndex);
    });
  },

  /**
   * 프로그레스 바를 초기화합니다.
   */
  _resetProgress() {
    this.el.progress.value = 0;
    this.el.currentTime.textContent = '0:00';
    this.el.duration.textContent = '0:00';
    this._updateSliderFill(this.el.progress, 0);
  },

  /**
   * range 슬라이더의 채워진 부분(왼쪽)을 CSS 변수로 설정합니다.
   *
   * @param {HTMLInputElement} slider - range input 요소
   * @param {number} [pct]            - 직접 퍼센트를 지정할 때 (선택사항)
   */
  _updateSliderFill(slider, pct) {
    const value = pct ?? ((parseFloat(slider.value) / parseFloat(slider.max || 100)) * 100);
    slider.style.setProperty('--pct', `${Math.max(0, Math.min(100, value))}%`);
  },

  // ══════════════════════════════════════════════════════
  // [6] 상태 저장 & 복원 (페이지 이동 대응)
  // ══════════════════════════════════════════════════════

  /**
   * 현재 재생 상태를 localStorage에 저장합니다.
   * 페이지를 떠나기 전(beforeunload)에 호출됩니다.
   */
  _saveState() {
    Storage.set(SK.INDEX,   this.currentIndex);
    Storage.set(SK.TIME,    this.audio.currentTime);
    Storage.set(SK.VOLUME,  this.audio.volume);
    Storage.set(SK.SHUFFLE, this.isShuffled);
    Storage.set(SK.REPEAT,  this.repeatMode);
  },

  /**
   * localStorage에서 이전 상태를 복원합니다.
   * 페이지 진입 시 호출됩니다.
   * 재생은 자동으로 시작하지 않습니다 (isPlaying = false).
   */
  _restoreState() {
    const savedIndex  = Storage.get(SK.INDEX,   0);
    const savedVolume = Storage.get(SK.VOLUME,  0.7);
    const savedShuffle= Storage.get(SK.SHUFFLE, false);
    const savedRepeat = Storage.get(SK.REPEAT,  'none');

    this.repeatMode = savedRepeat;
    this.isShuffled = savedShuffle;

    this.audio.volume = savedVolume;

    if (this.playlist.length > 0) {
      // 저장된 인덱스가 범위 내에 있으면 해당 곡 로드 (재생 X)
      const idx = Math.min(savedIndex, this.playlist.length - 1);
      this._loadTrack(idx, false);  // autoPlay = false → 정지 상태 유지
    }

    if (this.isShuffled) this._buildShuffleOrder();
  },
};

/**
 * 초(number)를 'M:SS' 형식의 문자열로 변환합니다.
 * @param {number} sec - 초
 * @returns {string} 예: '3:07'
 */
function formatTime(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default MusicPlayer;
````


## `js/modules/graph.js`

````javascript
/**
 * js/modules/graph.js — Obsidian 스타일 연결 그래프
 *
 * 기능:
 *   - 모든 포스트·카테고리·태그를 노드로 표시
 *   - D3 force simulation으로 동적 배치
 *   - 현재 보고 있는 포스트 노드가 크게 강조됨
 *   - 노드 클릭 시 해당 포스트로 이동
 *   - 드래그·줌·패닝 지원
 *   - 헤더의 🕸 그래프 버튼으로 열기/닫기
 */

import App    from '../core/app.js';
import Router from '../core/router.js';

const Graph = {
  _posts:       [],
  _currentFile: null,
  _isVisible:   false,
  _sim:         null,   // D3 전체 그래프 simulation
  _miniSim:     null,   // D3 미니 그래프 simulation
  _d3:          null,   // window.d3 참조

  // ─────────────────────────────────────────
  // [1] 초기화
  // ─────────────────────────────────────────

  init() {
    // 포스트 데이터 수신 → 미니 그래프 초기 렌더
    App.on('posts:loaded', ({ posts, categories }) => {
      this._posts = posts;
      this._categories = categories || [];
      // D3 로드 후 미니 그래프 그리기
      this._loadD3().then(() => {
        this._d3 = window.d3;
        this._rebuildMini();
      });
    });

    // 현재 포스트 추적
    App.on('router:post', ({ file }) => {
      this._currentFile = file;
      if (this._isVisible) this._rebuild();
      this._rebuildMini();
    });

    App.on('router:list', () => {
      this._currentFile = null;
      if (this._isVisible) this._rebuild();
      this._rebuildMini();
    });

    this._createButton();
    this._createOverlay();
  },

  // ─────────────────────────────────────────
  // [2] UI 생성
  // ─────────────────────────────────────────

  /** 헤더에 🕸 그래프 버튼 추가 */
  _createButton() {
    const controls = document.querySelector('.header-controls');
    if (!controls) return;

    const btn = document.createElement('button');
    btn.className  = 'theme-toggle';
    btn.id         = 'graphBtn';
    btn.title      = '연결 그래프 보기';
    btn.innerHTML  = '<span>🕸</span><span>그래프</span>';
    btn.addEventListener('click', () => this.toggle());

    // 색상 버튼 앞에 삽입
    const colorWrap = document.getElementById('colorPresetWrap');
    controls.insertBefore(btn, colorWrap);
  },

  /** 전체화면 오버레이 생성 */
  _createOverlay() {
    const el = document.createElement('div');
    el.id = 'graphOverlay';
    el.innerHTML = `
      <div class="graph-topbar">
        <div class="graph-topbar-left">
          <span class="graph-title">🕸 연결 그래프</span>
          <div class="graph-legend">
            <span class="legend-item">
              <svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="var(--accent)"/></svg>현재 글
            </span>
            <span class="legend-item">
              <svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="var(--graph-post)"/></svg>글
            </span>
            <span class="legend-item">
              <svg width="12" height="12"><rect width="12" height="12" rx="3" fill="var(--graph-cat)"/></svg>카테고리
            </span>
          </div>
        </div>
        <div class="graph-topbar-right">
          <span class="graph-hint">드래그 이동 · 스크롤 확대 · 노드 클릭으로 글 열기</span>
          <button class="graph-close-btn" id="graphClose" title="닫기">✕</button>
        </div>
      </div>
      <div class="graph-canvas-wrap">
        <svg id="graphSvg"></svg>
        <div id="graphTooltip" class="graph-tooltip"></div>
      </div>
    `;
    document.body.appendChild(el);

    document.getElementById('graphClose')
      .addEventListener('click', () => this.close());

    // 리사이즈 시 SVG 크기 갱신
    window.addEventListener('resize', () => {
      if (this._isVisible) this._resizeSvg();
    });
  },

  // ─────────────────────────────────────────
  // [3] 열기 / 닫기
  // ─────────────────────────────────────────

  toggle() {
    this._isVisible ? this.close() : this.open();
  },

  open() {
    this._loadD3().then(() => {
      this._isVisible = true;
      document.getElementById('graphOverlay').classList.add('open');
      document.getElementById('graphBtn').classList.add('active');
      document.body.style.overflow = 'hidden';
      this._rebuild();
    });
  },

  close() {
    this._isVisible = false;
    document.getElementById('graphOverlay').classList.remove('open');
    document.getElementById('graphBtn').classList.remove('active');
    document.body.style.overflow = '';
    if (this._sim) { this._sim.stop(); this._sim = null; }
    const svg = document.getElementById('graphSvg');
    if (svg) svg.innerHTML = '';
  },

  /** D3 v7 CDN에서 동적 로드 (이미 로드됐으면 스킵) */
  _loadD3() {
    if (window.d3) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
      s.onload  = resolve;
      s.onerror = () => reject(new Error('D3 로드 실패'));
      document.head.appendChild(s);
    });
  },

  // ─────────────────────────────────────────
  // [4] 그래프 데이터 빌드
  // ─────────────────────────────────────────

  /**
   * posts 배열에서 노드·링크 데이터를 만듭니다.
   *
   * 노드 타입:
   *   'post'     — 개별 글. 현재 보는 글은 r이 크고 accent 색.
   *   'category' — 카테고리 폴더 노드.
   *
   * 링크 타입:
   *   'cat' — 카테고리 계층(부모→자식) 또는 포스트↔카테고리
   */
  _buildData() {
    const posts = this._posts;
    const nodes = [];
    const links = [];
    const byId  = {};   // id → node (링크 연결용)

    const add = (node) => { nodes.push(node); byId[node.id] = node; return node; };

    // ── 카테고리 노드 & 계층 링크 ──
    const catSet = new Set();
    posts.forEach(p => {
      if (!p.category) return;
      p.category.split('/').reduce((acc, part) => {
        const full = acc ? `${acc}/${part}` : part;
        catSet.add(full);
        return full;
      }, '');
    });

    // 폴더 기반 빈 카테고리도 포함 (글이 없어도 카테고리 노드로 표시)
    (this._categories || []).forEach(cat => {
      cat.split('/').reduce((acc, part) => {
        const full = acc ? `${acc}/${part}` : part;
        catSet.add(full);
        return full;
      }, '');
    });

    // 카테고리별 총 포스트 수 (자기 자신 + 모든 하위 카테고리 포함)
    // 예: '개발'은 '개발/코드해설'의 글까지 합산됨
    const catPostCount = {};
    catSet.forEach(cat => { catPostCount[cat] = 0; });
    posts.forEach(p => {
      if (!p.category) return;
      let cur = '';
      p.category.split('/').forEach(part => {
        cur = cur ? `${cur}/${part}` : part;
        if (catPostCount[cur] !== undefined) catPostCount[cur]++;
      });
    });

    catSet.forEach(cat => {
      const parts = cat.split('/');
      const depth = parts.length;            // 1 = 최상위 폴더
      const count = catPostCount[cat] || 0;  // 하위 포함 총 글 수

      // 크기 = 기본값 + 깊이 보너스(상위일수록 큼) + 글 수 보너스(많을수록 큼)
      // 전체적으로 차분하게: 보너스 폭을 줄이고 최대 크기를 제한합니다.
      const depthBonus = Math.max(0, 3 - depth) * 2;   // depth1:+4, depth2:+2, depth3+:+0
      const countBonus = Math.sqrt(count) * 1.4;
      const r = Math.min(20, Math.round(8 + depthBonus + countBonus));

      add({
        id: `cat:${cat}`,
        type: 'category',
        label: parts[parts.length - 1],
        r, depth, count,
        isCurrent: false,
      });
    });

    // 부모 카테고리 → 자식 카테고리 링크
    catSet.forEach(cat => {
      const parts = cat.split('/');
      if (parts.length > 1) {
        const parent = parts.slice(0, -1).join('/');
        links.push({ source: `cat:${parent}`, target: `cat:${cat}`, ltype: 'cat', dist: 60 });
      }
    });

    // ── 포스트 노드 & 카테고리 링크 ──
    posts.forEach(p => {
      const isCurrent = (p.file === this._currentFile);
      const baseR     = isCurrent ? 14 : 7;

      add({ id: `post:${p.file}`, type: 'post', label: p.title || p.file, file: p.file, r: baseR, isCurrent });

      if (p.category && byId[`cat:${p.category}`]) {
        links.push({ source: `cat:${p.category}`, target: `post:${p.file}`, ltype: 'cat', dist: 55 });
      }
    });

    return { nodes, links };
  },

  // ─────────────────────────────────────────
  // [5] D3 렌더링
  // ─────────────────────────────────────────

  _rebuild() {
    if (this._sim) { this._sim.stop(); this._sim = null; }
    const svgEl = document.getElementById('graphSvg');
    if (!svgEl) return;
    svgEl.innerHTML = '';

    const { nodes, links } = this._buildData();
    if (!nodes.length) return;

    this._resizeSvg();
    const W = svgEl.clientWidth  || svgEl.getBoundingClientRect().width;
    const H = svgEl.clientHeight || svgEl.getBoundingClientRect().height;

    const d3  = window.d3;
    const svg = d3.select('#graphSvg');

    // ── 배경 클릭: 드래그한 게 아니면 닫지 않음 (그냥 포커스 해제용)
    svg.on('click', () => {});

    // ── 줌/패닝 ──
    const g    = svg.append('g').attr('class', 'graph-root');
    const zoom = d3.zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', (ev) => g.attr('transform', ev.transform));

    svg.call(zoom)
       .call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2));

    // ── 링크 ──
    const linkSel = g.append('g').attr('class', 'g-links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', d => `graph-link graph-link-${d.ltype}`);

    // ── 노드 그룹 ──
    const nodeSel = g.append('g').attr('class', 'g-nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', d => `g-node g-node-${d.type}${d.isCurrent ? ' g-node-current' : ''}`)
      .call(
        d3.drag()
          .on('start', (ev, d) => {
            if (!ev.active) this._sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
          .on('end',  (ev, d) => {
            if (!ev.active) this._sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // ── 현재 글 글로우 링 ──
    nodeSel.filter(d => d.isCurrent)
      .append('circle')
      .attr('class', 'node-glow')
      .attr('r', d => d.r + 5);

    // ── 카테고리 노드: 둥근 사각형 ──
    // 상위 폴더(depth가 작을수록)는 테두리도 더 굵게 그려서 위계를 한 번 더 강조합니다.
    nodeSel.filter(d => d.type === 'category')
      .append('rect')
      .attr('class', 'node-shape')
      .attr('width',  d => d.r * 1.9)
      .attr('height', d => d.r * 1.9)
      .attr('x', d => -d.r * 0.95)
      .attr('y', d => -d.r * 0.95)
      .attr('rx', 4)
      .style('stroke-width', d => `${Math.max(1.2, 2.6 - (d.depth - 1) * 0.5)}px`);

    // ── 포스트·태그 노드: 원 ──
    nodeSel.filter(d => d.type !== 'category')
      .append('circle')
      .attr('class', 'node-shape')
      .attr('r', d => d.r);

    // ── 라벨 ──
    // 카테고리는 깊이가 얕을수록(상위 폴더) 글자도 더 크게 표시해 위계를 강조합니다.
    nodeSel.append('text')
      .attr('class', 'node-label')
      .attr('dy', d => d.r + 13)
      .attr('text-anchor', 'middle')
      .style('font-size', d => {
        if (d.type !== 'category') return null;
        return `${Math.max(10, 13 - (d.depth - 1))}px`;
      })
      .style('font-weight', d => {
        if (d.type !== 'category') return null;
        return d.depth === 1 ? 700 : 600;
      })
      .text(d => {
        // 카테고리·현재 글·태그는 항상 표시
        if (d.type === 'category' || d.type === 'tag' || d.isCurrent) return d.label;
        // 일반 포스트: 글자 수 제한
        return d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label;
      });

    // ── 포스트 클릭 → 글 열기 ──
    nodeSel.filter(d => d.type === 'post')
      .style('cursor', 'pointer')
      .on('click', (ev, d) => {
        ev.stopPropagation();
        this.close();
        Router.goPost(d.file);
      });

    // ── 툴팁 ──
    const tooltip = document.getElementById('graphTooltip');
    nodeSel
      .on('mouseenter', (ev, d) => {
        // 카테고리는 포함된 글 수를 함께 보여줍니다.
        tooltip.textContent = d.type === 'category'
          ? `${d.label} (${d.count}개)`
          : d.label;
        tooltip.style.display = 'block';
        this._moveTooltip(ev);
      })
      .on('mousemove', (ev) => this._moveTooltip(ev))
      .on('mouseleave', () => { tooltip.style.display = 'none'; });

    // ── Force Simulation ──
    this._sim = d3.forceSimulation(nodes)
      .force('link',
        d3.forceLink(links)
          .id(d => d.id)
          .distance(d => d.dist || 60)
          .strength(0.7)
      )
      .force('charge', d3.forceManyBody().strength(d => {
        // 카테고리는 크기(r)에 비례해서 더 강하게 밀어내, 큰 노드 주변에 자연스러운 여유 공간이 생깁니다.
        if (d.type === 'category') return -90 - d.r * 7;
        if (d.isCurrent)          return -160;
        return -120;
      }))
      .force('collision', d3.forceCollide(d => d.r + 6))
      .force('x', d3.forceX(0).strength(0.04))
      .force('y', d3.forceY(0).strength(0.04))
      .on('tick', () => {
        linkSel
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });
  },

  /** SVG를 캔버스 컨테이너에 맞게 크기 설정 */
  _resizeSvg() {
    const wrap = document.querySelector('.graph-canvas-wrap');
    const svg  = document.getElementById('graphSvg');
    if (!wrap || !svg) return;
    svg.setAttribute('width',  wrap.clientWidth);
    svg.setAttribute('height', wrap.clientHeight);
  },

  _moveTooltip(ev) {
    const tt = document.getElementById('graphTooltip');
    if (!tt) return;
    tt.style.left = `${ev.clientX + 14}px`;
    tt.style.top  = `${ev.clientY - 36}px`;
  },

  // ─────────────────────────────────────────
  // [6] 미니 그래프 (사이드바 내장)
  // ─────────────────────────────────────────

  /**
   * 미니 그래프용 노드·링크 데이터를 빌드합니다.
   *
   * 포스트 뷰: 현재 게시글의 카테고리 경로 + 같은 카테고리 게시글만 표시
   * 목록 뷰: 모든 카테고리 + 모든 게시글
   */
  _buildMiniData() {
    const posts = this._posts;
    const nodes = [];
    const links = [];
    const byId  = {};
    const add   = n => { nodes.push(n); byId[n.id] = n; return n; };

    if (this._currentFile) {
      // ── 포스트 뷰: 현재 카테고리 계층 + 소속 포스트 ──
      const cur = posts.find(p => p.file === this._currentFile);
      const cat = cur?.category;
      if (!cat) return { nodes, links };

      // 카테고리 경로 계층 추가 (개발 → 개발/코드해설)
      const parts = cat.split('/');
      let pathSoFar = '';
      parts.forEach((part, i) => {
        const prev = pathSoFar;
        pathSoFar  = pathSoFar ? `${pathSoFar}/${part}` : part;
        const isLeaf = (i === parts.length - 1);
        add({ id: `cat:${pathSoFar}`, type: 'category', label: part,
              r: isLeaf ? 14 : 9, depth: i + 1, isCurrent: false });
        if (prev) links.push({ source: `cat:${prev}`, target: `cat:${pathSoFar}` });
      });

      // 해당 카테고리(하위 포함) 포스트
      posts
        .filter(p => p.category === cat || p.category?.startsWith(cat + '/'))
        .forEach(p => {
          const isCurrent = p.file === this._currentFile;
          add({ id: `post:${p.file}`, type: 'post',
                label: p.title || p.file, file: p.file,
                r: isCurrent ? 10 : 5, isCurrent });
          const linkTarget = byId[`cat:${p.category}`] ? `cat:${p.category}` : `cat:${cat}`;
          links.push({ source: linkTarget, target: `post:${p.file}` });
        });

    } else {
      // ── 목록 뷰: 카테고리 노드만 (포스트 제외 — 너무 많아서 뭉침) ──
      const catSet = new Set();
      const catPostCount = {};
      posts.forEach(p => {
        if (!p.category) return;
        p.category.split('/').reduce((acc, part) => {
          const full = acc ? `${acc}/${part}` : part;
          catSet.add(full);
          return full;
        }, '');
      });

      // 폴더 기반 빈 카테고리도 포함 (글이 없어도 카테고리 노드로 표시)
      (this._categories || []).forEach(cat => {
        cat.split('/').reduce((acc, part) => {
          const full = acc ? `${acc}/${part}` : part;
          catSet.add(full);
          return full;
        }, '');
      });
      // 각 카테고리의 포스트 수 집계
      catSet.forEach(c => { catPostCount[c] = 0; });
      posts.forEach(p => {
        if (!p.category) return;
        let cur = '';
        p.category.split('/').forEach(part => {
          cur = cur ? `${cur}/${part}` : part;
          if (catPostCount[cur] !== undefined) catPostCount[cur]++;
        });
      });

      catSet.forEach(cat => {
        const parts = cat.split('/');
        const depth = parts.length;
        const count = catPostCount[cat] || 0;
        const r = Math.min(18, Math.round(8 + Math.max(0, 3 - depth) * 3 + Math.sqrt(count) * 1.5));
        add({ id: `cat:${cat}`, type: 'category',
              label: parts[parts.length - 1], r, depth, count, isCurrent: false });
      });
      // 부모→자식 링크
      catSet.forEach(cat => {
        const parts = cat.split('/');
        if (parts.length > 1) {
          const parent = parts.slice(0, -1).join('/');
          links.push({ source: `cat:${parent}`, target: `cat:${cat}` });
        }
      });
    }

    return { nodes, links };
  },

  /** 미니 그래프를 D3로 렌더링합니다. */
  _rebuildMini() {
    const d3    = this._d3 || window.d3;
    const svgEl = document.getElementById('miniGraphSvg');
    if (!d3 || !svgEl) return;

    if (this._miniSim) { this._miniSim.stop(); this._miniSim = null; }

    const w = svgEl.clientWidth  || 220;
    const h = svgEl.clientHeight || 185;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const { nodes, links } = this._buildMiniData();
    if (!nodes.length) return;

    // 링크 ID 해석
    const nodeById = {};
    nodes.forEach(n => { nodeById[n.id] = n; });
    const validLinks = links.filter(l => nodeById[l.source] && nodeById[l.target]);

    // 줌/패닝
    const g = svg.append('g');
    // 현재 줌/팬 변환을 저장 → 드래그 시 포인터 좌표를 시뮬레이션 좌표로 역변환하는 데 사용
    let miniTransform = d3.zoomIdentity;
    svg.call(
      d3.zoom()
        .scaleExtent([0.4, 4])
        .on('zoom', ev => { miniTransform = ev.transform; g.attr('transform', ev.transform); })
    );

    // 링크
    const linkSel = g.append('g')
      .selectAll('line')
      .data(validLinks)
      .join('line')
      .style('stroke', 'var(--border)')
      .style('stroke-width', '1px')
      .style('stroke-opacity', '0.7');

    // 노드 그룹
    const nodeSel = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', d => d.type === 'post' ? 'pointer' : 'default');

    // 카테고리 → 둥근 사각형 (style로 CSS 변수 적용)
    nodeSel.filter(d => d.type === 'category')
      .append('rect')
      .attr('rx', 3).attr('ry', 3)
      .attr('x',      d => -d.r)
      .attr('y',      d => -d.r * 0.65)
      .attr('width',  d => d.r * 2)
      .attr('height', d => d.r * 1.3)
      .style('fill',         'var(--accent)')
      .style('fill-opacity', '0.75')
      .style('stroke',       'var(--accent)')
      .style('stroke-width', d => `${Math.max(1, 2.2 - (d.depth - 1) * 0.4)}px`);

    // 카테고리 레이블
    nodeSel.filter(d => d.type === 'category')
      .append('text')
      .text(d => d.label.length > 5 ? d.label.slice(0, 5) + '…' : d.label)
      .attr('font-size', d => `${Math.max(7, 9 - (d.depth - 1))}px`)
      .style('fill', 'var(--bg)')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('pointer-events', 'none');

    // 게시글 → 원
    nodeSel.filter(d => d.type === 'post')
      .append('circle')
      .attr('r', d => d.r)
      .style('fill',         d => d.isCurrent ? 'var(--accent)' : 'var(--text-muted)')
      .style('fill-opacity', d => d.isCurrent ? '1' : '0.6')
      .style('stroke',       d => d.isCurrent ? '#fff' : 'none')
      .style('stroke-width', '1.5px');

    // 현재 게시글 레이블
    nodeSel.filter(d => d.isCurrent)
      .append('text')
      .text(d => d.label.length > 8 ? d.label.slice(0, 8) + '…' : d.label)
      .attr('font-size', '7px')
      .style('fill', 'var(--accent)')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 9)
      .style('pointer-events', 'none');

    // 클릭 → 포스트 이동
    nodeSel.filter(d => d.type === 'post')
      .on('click', (ev, d) => { Router.goPost(d.file); });

    // 툴팁
    const tip = document.getElementById('miniGraphTooltip');
    nodeSel
      .on('mouseenter', (ev, d) => { if (tip) { tip.textContent = d.label; tip.style.opacity = '1'; } })
      .on('mouseleave', ()       => { if (tip) tip.style.opacity = '0'; });

    // 드래그
    // 포인터 좌표(svg 기준)를 현재 줌 변환의 역으로 풀어 시뮬레이션 좌표로 변환합니다.
    // → 확대/이동한 상태에서도 노드가 커서를 정확히 따라옵니다.
    nodeSel.call(
      d3.drag()
        .on('start', (ev, d) => {
          if (!ev.active) this._miniSim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag',  (ev, d) => {
          const [px, py] = miniTransform.invert(d3.pointer(ev, svgEl));
          d.fx = px; d.fy = py;
        })
        .on('end',   (ev, d) => {
          if (!ev.active) this._miniSim.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
    );

    // Force simulation — 좁은 공간(~220×185)에 맞춘 파라미터
    this._miniSim = d3.forceSimulation(nodes)
      .force('link',
        d3.forceLink(validLinks)
          .id(d => d.id)
          .distance(d => {
            const src = nodeById[typeof d.source === 'object' ? d.source.id : d.source];
            return src?.type === 'category' ? 55 : 38;
          })
          .strength(1)
      )
      .force('charge', d3.forceManyBody().strength(d =>
        d.type === 'category' ? -120 - d.r * 6 : -60
      ))
      .force('center',    d3.forceCenter(w / 2, h / 2).strength(0.3))
      .force('collision', d3.forceCollide(d => d.r + 6))
      .alphaDecay(0.025)
      .on('tick', () => {
        // ── 노드를 SVG 영역 안으로 가두기 ──
        // 중요: d.x/d.y 값 자체를 보정해야 링크(선)와 노드(상자)가 같은
        // 좌표를 공유합니다. (예전엔 노드만 transform에서 clamp하고 링크는
        // 원본 좌표를 써서 선이 상자에 닿지 않았음)
        // 벽에 닿으면 해당 축 속도(vx/vy)를 0으로 눌러 떨림도 줄입니다.
        nodes.forEach(d => {
          const nx = Math.max(d.r + 2, Math.min(w - d.r - 2, d.x ?? w / 2));
          const ny = Math.max(d.r + 2, Math.min(h - d.r - 2, d.y ?? h / 2));
          if (nx !== d.x) { d.x = nx; d.vx = 0; }
          if (ny !== d.y) { d.y = ny; d.vy = 0; }
        });

        linkSel
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
      });
  },
};

export default Graph;
````


## `js/modules/editor.js`

````javascript
/**
 * js/modules/editor.js — 마크다운 글 작성 에디터
 *
 * 기능:
 *   - Front Matter 폼 (제목, 날짜, 카테고리, 태그, 요약)
 *   - 마크다운 textarea 에디터
 *   - 실시간 미리보기 (marked.js 사용)
 *   - 서식 버튼 (볼드, 이탤릭, 코드, 링크, 제목 등)
 *   - File System Access API로 파일 직접 저장
 *   - 저장 후 build.js 실행 안내 토스트
 *   - 탭 키 들여쓰기 지원
 */

import Markdown    from './markdown.js';
import PostEnhance from './post-enhance.js';

const Editor = {
  /** 현재 열려있는 파일 핸들 (File System Access API, 로컬 전용) */
  _fileHandle: null,

  /**
   * 에디터를 초기화합니다.
   * DOM이 준비된 후 호출해야 합니다.
   */
  async init() {
    this._bindFormPreview();   // Front Matter 변경 → 미리보기 업데이트
    await this._bindCategoryDropdown(); // 카테고리 드롭다운 (posts.json 연동)
    this._bindTextarea();      // 본문 입력 → 미리보기 업데이트
    this._bindFormatBtns();    // 서식 버튼 클릭
    this._bindSaveBtn();       // 로컬 저장 버튼
    this._bindPublishBtn();    // GitHub 게시 버튼
    this._bindDeleteBtn();     // GitHub 삭제 버튼(수정 중일 때만)
    this._bindNewBtn();        // 새 글 버튼
    this._bindGitHubSettings();// GitHub 설정 패널
    this._setDefaultDate();    // 날짜 기본값: 오늘
    this._updatePreview();     // 초기 미리보기
    this._applyGitHubSettingsToUI(); // 저장된 설정 복원
    await this._loadEditParam();     // ?edit=경로 있으면 기존 글 불러오기(수정)
  },

  // ══════════════════════════════════════════════════════
  // [1] Front Matter 폼
  // ══════════════════════════════════════════════════════

  /**
   * Front Matter 폼의 모든 입력 필드가 바뀔 때마다 미리보기를 업데이트합니다.
   */
  _bindFormPreview() {
    const fields = ['fmTitle', 'fmDate', 'fmCategory', 'fmTags', 'fmExcerpt'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this._updatePreview());
    });
  },

  // ══════════════════════════════════════════════════════
  // [1-2] 카테고리 드롭다운 (posts.json 연동)
  // ══════════════════════════════════════════════════════

  /**
   * 카테고리 드롭다운을 posts.json의 실제 카테고리로 채우고,
   * 선택 값을 실제 저장에 쓰이는 #fmCategory input에 반영합니다.
   *
   * 옵션 구성:
   *   ''        → (파일 경로에서 자동) — 비워두면 build.js가 폴더 경로로 채움
   *   각 카테고리 → posts.json에서 뽑은 실제 카테고리들
   *   '__new__' → + 새 카테고리 직접 입력 → 텍스트 입력칸 노출
   *
   * posts.json fetch 실패(file://로 열었을 때 등) 시:
   *   드롭다운은 기본 옵션만 두고, 직접 입력 input을 항상 쓸 수 있게 폴백.
   */
  async _bindCategoryDropdown() {
    const select   = document.getElementById('fmCategorySelect');
    const textInput = document.getElementById('fmCategory');
    if (!select || !textInput) return;

    const NEW = '__new__';

    // 드롭다운 변경 → 실제 값(#fmCategory) 세팅
    select.addEventListener('change', () => {
      if (select.value === NEW) {
        // 직접 입력 모드: 텍스트칸 노출 + 값 비우고 포커스
        textInput.style.display = '';
        textInput.value = '';
        textInput.focus();
      } else {
        // 기존 카테고리(또는 자동) 선택: 텍스트칸 숨기고 값 반영
        textInput.style.display = 'none';
        textInput.value = select.value; // '' 이면 build.js가 폴더로 자동 분류
      }
      this._updatePreview();
    });

    // 카테고리 목록 로드
    //   posts.json     → 글이 있는 카테고리
    //   categories.json → 폴더 기반(글 없는 빈 카테고리 포함)
    // 둘을 합쳐야 "잡다"처럼 글 없는 빈 카테고리도 드롭다운에 나옵니다.
    const catSet = new Set();
    try {
      const res  = await fetch('posts/posts.json', { cache: 'no-store' });
      const data = await res.json();
      data.forEach(p => { if (p.category) catSet.add(p.category); });
    } catch (err) {
      // file://로 열면 fetch가 막힘 → 직접 입력만으로 폴백
      console.warn('[Editor] posts.json 로드 실패, 직접 입력만 사용:', err.message);
    }
    try {
      const cres = await fetch('posts/categories.json', { cache: 'no-store' });
      if (cres.ok) (await cres.json()).forEach(c => { if (c) catSet.add(c); });
    } catch (_) { /* categories.json 없어도 무방 */ }
    const categories = [...catSet].sort();

    const opts = [
      `<option value="">(파일 경로에서 자동)</option>`,
      ...categories.map(c => `<option value="${c}">${c}</option>`),
      `<option value="${NEW}">+ 새 카테고리 직접 입력</option>`,
    ];
    select.innerHTML = opts.join('');
    textInput.style.display = 'none'; // 시작은 드롭다운 모드
  },

  /**
   * URL에 ?edit=경로 가 있으면 기존 글을 불러와 폼에 채웁니다. (게시글 수정)
   * 파일명 칸에 원래 경로가 채워지므로, 게시하면 GitHub의 같은 파일을 덮어씁니다.
   */
  async _loadEditParam() {
    const params = new URLSearchParams(location.search);
    const file = params.get('edit') || params.get('file');
    if (!file) return;
    try {
      const res = await fetch('posts/' + file, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { meta, content } = Markdown.parseFrontMatter(await res.text());

      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('fmTitle',        meta.title   || '');
      set('fmDate',         meta.date    || '');
      set('fmTags',         (meta.tags   || []).join(', '));
      set('fmExcerpt',      meta.excerpt || '');
      set('editorTextarea', content.replace(/^\n+/, ''));
      set('filenameInput',  file);   // 같은 파일 덮어쓰기

      // 카테고리: 드롭다운에 있으면 선택, 없으면 직접입력으로 표시
      const catSel = document.getElementById('fmCategorySelect');
      const catInput = document.getElementById('fmCategory');
      if (catInput) catInput.value = meta.category || '';
      if (catSel) {
        catSel.value = meta.category || '';
        if (catSel.value !== (meta.category || '')) {
          if ([...catSel.options].some(o => o.value === '__new__')) catSel.value = '__new__';
          if (catInput) catInput.style.display = '';
        } else if (catInput) {
          catInput.style.display = 'none';
        }
      }

      const pub = document.getElementById('publishBtn');
      if (pub) pub.innerHTML = '🚀 수정 게시';
      const del = document.getElementById('deleteBtn');
      if (del) del.style.display = '';   // 수정 모드에서만 삭제 버튼 표시

      this._updatePreview();
      showToast('✏️ 기존 글 불러옴: ' + file);
    } catch (e) {
      console.error('[Editor] 수정 불러오기 실패:', e);
      showToast('불러오기 실패: ' + e.message);
    }
  },

  /**
   * 오늘 날짜를 'YYYY-MM-DD' 형식으로 날짜 입력 필드에 설정합니다.
   */
  _setDefaultDate() {
    const dateEl = document.getElementById('fmDate');
    if (dateEl && !dateEl.value) {
      const today = new Date().toISOString().slice(0, 10);
      dateEl.value = today;
    }
  },

  /**
   * 폼에서 현재 입력된 Front Matter 값을 객체로 반환합니다.
   * @returns {{ title, date, category, tags, excerpt }}
   */
  _getFormValues() {
    return {
      title:    document.getElementById('fmTitle')?.value.trim()    || '',
      date:     document.getElementById('fmDate')?.value.trim()     || '',
      category: document.getElementById('fmCategory')?.value.trim() || '',
      tags:     document.getElementById('fmTags')?.value.trim()     || '',
      excerpt:  document.getElementById('fmExcerpt')?.value.trim()  || '',
    };
  },

  // ══════════════════════════════════════════════════════
  // [2] 실시간 미리보기
  // ══════════════════════════════════════════════════════

  /**
   * textarea 입력에 미리보기를 연결합니다.
   * 타이핑할 때마다 150ms 디바운스 후 미리보기 업데이트
   * (디바운스: 연속 입력 중엔 기다렸다가 멈추면 한 번만 실행)
   */
  _bindTextarea() {
    const ta = document.getElementById('editorTextarea');
    if (!ta) return;

    let timer = null;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this._updatePreview(), 150);
    });
  },

  /**
   * 미리보기 패널을 현재 폼 + 본문 내용으로 업데이트합니다.
   */
  _updatePreview() {
    const meta    = this._getFormValues();
    const content = document.getElementById('editorTextarea')?.value || '';

    // 미리보기 헤더 (제목, 날짜, 카테고리, 태그)
    const headerEl = document.getElementById('previewHeader');
    if (headerEl) {
      const tagsHtml = meta.tags
        ? meta.tags.split(',').map(t => `<span class="post-tag">#${t.trim()}</span>`).join('')
        : '';

      headerEl.innerHTML = `
        ${meta.category ? `<span class="post-category">${meta.category}</span>` : ''}
        <h1>${meta.title || '<span style="color:var(--text-muted)">제목을 입력하세요</span>'}</h1>
        <div class="post-card-meta">
          <span class="post-date">${meta.date ? formatDate(meta.date) : ''}</span>
          <div class="post-tags">${tagsHtml}</div>
        </div>
      `;
    }

    // 미리보기 본문
    const bodyEl = document.getElementById('previewBody');
    if (bodyEl) {
      if (content.trim()) {
        bodyEl.innerHTML = Markdown.parse(content);
        // 코드 하이라이팅 + 헤더 토글을 미리보기에도 적용
        PostEnhance.apply(bodyEl);
      } else {
        bodyEl.innerHTML = `
          <div class="preview-empty">
            <div class="icon">✏️</div>
            <p>왼쪽에서 마크다운을 입력하면<br>여기에 미리보기가 표시됩니다.</p>
          </div>`;
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // [3] 서식 버튼 (볼드, 이탤릭, 링크 등)
  // ══════════════════════════════════════════════════════

  /**
   * 서식 버튼들의 클릭 이벤트를 연결합니다.
   * data-format 속성으로 어떤 서식을 적용할지 결정합니다.
   */
  _bindFormatBtns() {
    const bar = document.getElementById('formatBar');
    if (!bar) return;

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.fmt-btn');
      if (!btn) return;
      const format = btn.dataset.format;
      this._applyFormat(format);
    });
  },

  /**
   * textarea에서 선택된 텍스트에 마크다운 서식을 적용합니다.
   * 선택 영역이 없으면 플레이스홀더 텍스트를 삽입합니다.
   *
   * @param {string} format - 서식 종류 ('bold', 'italic', 'code', 등)
   */
  _applyFormat(format) {
    const ta    = document.getElementById('editorTextarea');
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.slice(start, end); // 선택된 텍스트

    // 서식별 변환 규칙: [앞에 붙을 것, 뒤에 붙을 것, 기본 텍스트]
    const rules = {
      bold:       ['**',  '**',  '굵게'],
      italic:     ['*',   '*',   '기울임'],
      strike:     ['~~',  '~~',  '취소선'],
      code:       ['`',   '`',   '코드'],
      codeblock:  ['```\n', '\n```', '코드 블록'],
      link:       ['[',   '](URL)', '링크 텍스트'],
      image:      ['![',  '](URL)', '이미지 설명'],
      h2:         ['## ', '',    '제목 2'],
      h3:         ['### ','',    '제목 3'],
      quote:      ['> ',  '',    '인용문'],
      hr:         ['\n---\n', '', ''],
      ul:         ['- ',  '',    '목록 항목'],
      ol:         ['1. ', '',    '목록 항목'],
    };

    const rule = rules[format];
    if (!rule) return;

    const [before, after, placeholder] = rule;
    const text = sel || placeholder; // 선택된 게 없으면 기본 텍스트 사용

    // textarea 값 교체 (execCommand는 deprecated, 직접 문자열 조작)
    const newVal =
      ta.value.slice(0, start) +
      before + text + after +
      ta.value.slice(end);

    ta.value = newVal;

    // 커서 위치: 삽입된 텍스트 끝으로 이동
    const newPos = start + before.length + text.length + after.length;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();

    this._updatePreview();
  },

  // ══════════════════════════════════════════════════════
  // [4] GitHub 게시
  // ══════════════════════════════════════════════════════

  /** GitHub 설정을 localStorage에서 가져옵니다. */
  _getGitHubSettings() {
    return {
      // 토큰은 잠금 해제된 세션(EditorAuth)에서 가져옵니다. (평문 저장 안 함)
      token:  (window.EditorAuth && window.EditorAuth.getToken()) || localStorage.getItem('gh_token') || '',
      owner:  localStorage.getItem('gh_owner')  || '0oo0mu',
      repo:   localStorage.getItem('gh_repo')   || 'oomu-blog',
      branch: localStorage.getItem('gh_branch') || 'main',
    };
  },

  /** GitHub 설정 패널의 현재 값을 localStorage에 저장합니다. */
  _saveGitHubSettings() {
    const fields = ['gh_token', 'gh_owner', 'gh_repo', 'gh_branch'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) localStorage.setItem(id, el.value.trim());
    });
    showToast('✅ GitHub 설정 저장됨');
    document.getElementById('ghSettingsPanel').classList.remove('open');
  },

  /** 저장된 설정 값을 설정 패널 폼에 채웁니다. */
  _applyGitHubSettingsToUI() {
    const s = this._getGitHubSettings();
    const map = { gh_token: s.token, gh_owner: s.owner, gh_repo: s.repo, gh_branch: s.branch };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
  },

  /** GitHub 설정 버튼·패널 이벤트 연결 */
  _bindGitHubSettings() {
    document.getElementById('ghSettingsBtn')
      ?.addEventListener('click', () => {
        document.getElementById('ghSettingsPanel').classList.toggle('open');
      });

    document.getElementById('ghSaveSettingsBtn')
      ?.addEventListener('click', () => this._saveGitHubSettings());

    // 설정 패널 바깥 클릭 시 닫기
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('ghSettingsPanel');
      const btn   = document.getElementById('ghSettingsBtn');
      if (panel?.classList.contains('open') &&
          !panel.contains(e.target) &&
          !btn?.contains(e.target)) {
        panel.classList.remove('open');
      }
    });
  },

  /** 게시 버튼 클릭 이벤트 연결 */
  _bindPublishBtn() {
    document.getElementById('publishBtn')
      ?.addEventListener('click', () => this._publishToGitHub());
  },

  /**
   * 게시할 파일 경로(posts/ 기준 상대경로)를 결정합니다.
   *   - 파일명 칸에 직접 넣었으면 그 값을 사용(고급/override)
   *   - 비어 있으면 "카테고리/제목-슬러그.md" 로 자동 생성
   *     → 폴더가 항상 카테고리와 일치하므로 어긋남이 생기지 않습니다.
   */
  _resolveRelPath() {
    const manual = document.getElementById('filenameInput')?.value.trim();
    if (manual) return manual.endsWith('.md') ? manual : manual + '.md';

    const { category, title } = this._getFormValues();
    const slug = (title || '새-글')
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
    return (category ? category + '/' : '') + slug + '.md';
  },

  /**
   * GitHub API를 통해 글을 저장소에 직접 커밋합니다.
   *
   * 흐름:
   *   1. 설정(토큰·저장소) 확인
   *   2. 파일 경로 확인
   *   3. 기존 파일이 있으면 SHA 조회 (업데이트 시 필요)
   *   4. PUT /repos/{owner}/{repo}/contents/{path} 로 파일 생성/수정
   *   5. GitHub Actions가 자동으로 빌드·배포
   */
  async _publishToGitHub() {
    const { token, owner, repo, branch } = this._getGitHubSettings();

    // ── 설정 검증 ──
    if (!token || !owner || !repo) {
      showToast('⚙️ 먼저 GitHub 설정을 입력하세요 (⚙️ 버튼)');
      document.getElementById('ghSettingsPanel')?.classList.add('open');
      return;
    }

    const relPath = this._resolveRelPath();
    if (!relPath || relPath === '.md' || relPath === '새-글.md') {
      showToast('📝 제목을 입력하거나(자동 경로) 파일 경로를 지정하세요');
      document.getElementById('fmTitle')?.focus();
      return;
    }

    const filePath = `posts/${relPath}`;
    const content  = this._buildFileContent();
    const title    = document.getElementById('fmTitle')?.value.trim() || '새 글';

    // 버튼 로딩 상태
    const btn = document.getElementById('publishBtn');
    const origText = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 게시 중...'; }

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

      // ── 기존 파일 SHA 조회 (파일 업데이트 시 sha가 필요) ──
      let sha = null;
      try {
        const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });
        if (getRes.ok) {
          const data = await getRes.json();
          sha = data.sha;
        }
      } catch { /* 파일 없음 → 신규 생성 */ }

      // ── 파일 커밋 ──
      const body = {
        message: sha ? `글 수정: ${title}` : `새 글: ${title}`,
        content: btoa(unescape(encodeURIComponent(content))), // UTF-8 → Base64
        branch,
      };
      if (sha) body.sha = sha; // 기존 파일 업데이트 시 필수

      const putRes = await fetch(apiBase, {
        method:  'PUT',
        headers,
        body:    JSON.stringify(body),
      });

      if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || `HTTP ${putRes.status}`);
      }

      const action = sha ? '수정' : '게시';
      showToast(`🚀 ${action} 완료! GitHub Actions가 1~2분 내 배포합니다.`, 5000);

    } catch (err) {
      console.error('[Editor] GitHub 게시 실패:', err);
      if (err.message.includes('Bad credentials')) {
        showToast('❌ 토큰이 잘못되었습니다. GitHub 설정을 확인하세요.');
      } else if (err.message.includes('Not Found')) {
        showToast('❌ 저장소를 찾을 수 없습니다. owner/repo를 확인하세요.');
      } else {
        showToast('❌ 게시 실패: ' + err.message);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
    }
  },

  /** 삭제 버튼 클릭 이벤트 연결 */
  _bindDeleteBtn() {
    document.getElementById('deleteBtn')
      ?.addEventListener('click', () => this._deleteFromGitHub());
  },

  /**
   * GitHub API로 현재 불러온 글 파일을 저장소에서 삭제합니다.
   *   1. 파일 경로 확인(수정으로 불러온 글만 대상)
   *   2. 파일 SHA 조회
   *   3. DELETE /repos/{owner}/{repo}/contents/{path}
   *   4. GitHub Actions가 자동 재배포 → 목록으로 이동
   */
  async _deleteFromGitHub() {
    const { token, owner, repo, branch } = this._getGitHubSettings();
    if (!token || !owner || !repo) {
      showToast('⚙️ 먼저 GitHub 설정을 입력하세요 (⚙️ 버튼)');
      document.getElementById('ghSettingsPanel')?.classList.add('open');
      return;
    }

    const manual = document.getElementById('filenameInput')?.value.trim();
    if (!manual) {
      showToast('🗑️ 삭제할 글이 없습니다. (수정으로 불러온 글만 삭제 가능)');
      return;
    }
    const relPath  = manual.endsWith('.md') ? manual : manual + '.md';
    const filePath = `posts/${relPath}`;

    if (!confirm(`정말 삭제할까요?\n\n${filePath}\n\n(되돌리려면 git 기록에서 복구해야 합니다)`)) return;

    const btn = document.getElementById('deleteBtn');
    const origText = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 삭제 중...'; }

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

      // 파일 SHA 조회 (삭제에 필수)
      const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });
      if (getRes.status === 404) { showToast('❌ 저장소에 그 파일이 없습니다.'); return; }
      if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
      const { sha } = await getRes.json();

      // 삭제
      const delRes = await fetch(apiBase, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ message: `글 삭제: ${relPath}`, sha, branch }),
      });
      if (!delRes.ok) {
        const e = await delRes.json();
        throw new Error(e.message || `HTTP ${delRes.status}`);
      }

      showToast('🗑️ 삭제 완료! 1~2분 내 반영됩니다. 목록으로 이동합니다.', 4000);
      setTimeout(() => { window.location.href = 'index.html'; }, 1500);

    } catch (err) {
      console.error('[Editor] 삭제 실패:', err);
      if (err.message.includes('Bad credentials')) {
        showToast('❌ 토큰이 잘못되었습니다.');
      } else {
        showToast('❌ 삭제 실패: ' + err.message);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
    }
  },

  // ══════════════════════════════════════════════════════
  // [5] 로컬 파일 저장 (File System Access API)
  // ══════════════════════════════════════════════════════

  /**
   * 저장 버튼 클릭 이벤트를 연결합니다.
   */
  _bindSaveBtn() {
    const btn = document.getElementById('saveBtn');
    if (btn) btn.addEventListener('click', () => this.save());
  },

  /**
   * 새 글 버튼 클릭 시 폼과 에디터를 초기화합니다.
   */
  _bindNewBtn() {
    const btn = document.getElementById('newBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (confirm('현재 작성 중인 내용이 사라집니다. 새로 시작할까요?')) {
        this._fileHandle = null;
        document.getElementById('fmTitle').value    = '';
        document.getElementById('fmDate').value     = new Date().toISOString().slice(0, 10);
        document.getElementById('fmCategory').value = '';
        // 카테고리 드롭다운도 '자동'으로 되돌리고 직접입력칸 숨김
        const catSel = document.getElementById('fmCategorySelect');
        if (catSel) catSel.value = '';
        document.getElementById('fmCategory').style.display = 'none';
        document.getElementById('fmTags').value     = '';
        document.getElementById('fmExcerpt').value  = '';
        document.getElementById('editorTextarea').value = '';
        document.getElementById('filenameInput').value  = '';
        this._updatePreview();
      }
    });
  },

  /**
   * .md 파일 내용을 생성합니다.
   * Front Matter + 본문을 합쳐서 반환합니다.
   *
   * @returns {string} .md 파일 전체 텍스트
   */
  _buildFileContent() {
    const { title, date, category, tags, excerpt } = this._getFormValues();
    const body = document.getElementById('editorTextarea')?.value || '';

    // 태그: "JS, CSS" → [JS, CSS] 형식으로 변환
    const tagsFormatted = tags
      ? '[' + tags.split(',').map(t => t.trim()).filter(Boolean).join(', ') + ']'
      : '[]';

    const frontMatter = [
      '---',
      `title: ${title}`,
      `date: ${date}`,
      category ? `category: ${category}` : null,
      `tags: ${tagsFormatted}`,
      excerpt ? `excerpt: ${excerpt}` : null,
      '---',
    ].filter(Boolean).join('\n'); // null 제거 후 합침

    return frontMatter + '\n\n' + body;
  },

  /**
   * File System Access API를 사용해서 파일을 저장합니다.
   *
   * 동작:
   *   - 처음 저장: 파일 선택 창 열림 → posts/ 폴더에 저장
   *   - 이후 저장: 같은 파일에 덮어씀 (창 안 열림)
   *
   * 브라우저 미지원 시: 자동으로 다운로드로 폴백합니다.
   */
  async save() {
    const content  = this._buildFileContent();
    const filename = this._getSuggestedFilename();

    // 브라우저 구분 없이 항상 다운로드 폴더로 저장합니다.
    // (Chrome/Edge의 "다른 이름으로 저장" 창을 쓰지 않고 바로 다운로드)
    this._downloadFile(content, filename);
  },

  /**
   * 제목으로부터 파일명을 생성합니다.
   * 한글/영문/숫자만 남기고, 공백은 하이픈으로 변환합니다.
   *
   * @returns {string} 예: '나의-첫-글.md'
   */
  _getSuggestedFilename() {
    const filenameInput = document.getElementById('filenameInput')?.value.trim();
    if (filenameInput) {
      return filenameInput.endsWith('.md') ? filenameInput : filenameInput + '.md';
    }

    const title = document.getElementById('fmTitle')?.value.trim() || '새-글';
    return title
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50) + '.md';
  },

  /**
   * File System Access API 미지원 시 다운로드로 폴백합니다.
   * @param {string} content  - 파일 내용
   * @param {string} filename - 파일명
   */
  _downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this._showSaveSuccess(true); // 다운로드 안내 포함
  },

  // ══════════════════════════════════════════════════════
  // [5] 저장 성공 토스트 알림
  // ══════════════════════════════════════════════════════

  /**
   * 저장 완료 토스트 메시지를 표시합니다.
   * @param {boolean} isDownload - true면 다운로드 폴백 메시지 표시
   */
  _showSaveSuccess(isDownload = false) {
    // 저장 버튼을 일시적으로 초록색으로 변경
    const btn = document.getElementById('saveBtn');
    if (btn) {
      btn.classList.add('saved');
      btn.textContent = '✅ 저장됨';
      setTimeout(() => {
        btn.classList.remove('saved');
        btn.innerHTML = '💾 저장';
      }, 2000);
    }

    // 토스트 표시
    const msg = isDownload
      ? '📥 다운로드됨 — posts/ 폴더에 옮긴 후 node build.js 실행하세요'
      : '✅ 저장 완료 — node build.js 를 실행해서 목록을 업데이트하세요';

    showToast(msg);
  },
};

/**
 * 날짜 문자열을 한국어 형식으로 변환합니다.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * 화면 하단에 토스트 메시지를 잠깐 표시합니다.
 * @param {string} message - 표시할 텍스트
 * @param {number} duration - 표시 시간 ms (기본: 4000)
 */
function showToast(message, duration = 4000) {
  // 기존 토스트 제거
  document.querySelector('.toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // 다음 프레임에 show 클래스 추가 → CSS transition 발동
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  // duration 후 내려가며 사라짐
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export default Editor;
````


## `js/modules/editor-auth.js`

````javascript
/**
 * js/modules/editor-auth.js — 에디터 진입 잠금 + GitHub 토큰 보관
 *
 * 목적:
 *   에디터(editor.html)에 들어올 때 "내가 정한 비밀번호"로 잠금을 풀어야 하고,
 *   실제 GitHub 토큰(PAT)은 그 비밀번호로 암호화되어 브라우저(localStorage)에만 보관됩니다.
 *
 * 동작 요약:
 *   - 최초 1회: GitHub 토큰 + 내가 정한 비밀번호 입력 → 토큰을 비번으로 암호화해 저장
 *   - 이후: 비밀번호만 입력하면 복호화되어 세션이 열림 (토큰은 다시 볼 일 없음)
 *   - 세션은 10분 유지되며, 입력·활동·[연장] 버튼이 있으면 자동으로 시간 연장(슬라이딩)
 *   - 10분간 활동이 없으면 다시 잠금
 *
 * 보안 메모:
 *   토큰은 비번으로 AES-GCM 암호화(Web Crypto)되어 저장됩니다. 비번은 저장되지 않습니다.
 *   정적 사이트라 서버가 없으므로, 이 브라우저 안에서만 유효합니다(다른 PC에선 최초 설정 1회 필요).
 */

const SESSION_MIN = 10;                 // 세션 유지(분)
const LS_ENC   = 'gh_token_enc';        // localStorage: 암호화된 토큰
const SS_SESS  = 'editor_session';      // sessionStorage: { token, until }

// ── base64 헬퍼 (작은 데이터라 단순 방식으로 충분) ──
const b64   = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s)  => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const EditorAuth = {
  _tickTimer: null,

  // ══════════════════════════════════════════════
  // 암호화 (Web Crypto: PBKDF2 → AES-GCM)
  // ══════════════════════════════════════════════
  async _deriveKey(password, salt) {
    const base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },

  async _encrypt(token, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await this._deriveKey(password, salt);
    const ct   = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(token)
    );
    localStorage.setItem(LS_ENC, JSON.stringify({
      salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)),
    }));
  },

  async _decrypt(password) {
    const raw = localStorage.getItem(LS_ENC);
    if (!raw) return null;
    const { salt, iv, ct } = JSON.parse(raw);
    const key = await this._deriveKey(password, unb64(salt));
    const pt  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct)
    ); // 비번 틀리면 여기서 예외 발생
    return new TextDecoder().decode(pt);
  },

  hasToken() { return !!localStorage.getItem(LS_ENC); },

  reset() { localStorage.removeItem(LS_ENC); this.lock(); },

  // ══════════════════════════════════════════════
  // 세션 (sessionStorage, 슬라이딩 만료)
  // ══════════════════════════════════════════════
  _saveSession(token) {
    sessionStorage.setItem(SS_SESS, JSON.stringify({
      token, until: Date.now() + SESSION_MIN * 60 * 1000,
    }));
  },
  _session() {
    const raw = sessionStorage.getItem(SS_SESS);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() > s.until) { sessionStorage.removeItem(SS_SESS); return null; }
    return s;
  },
  getToken()   { return this._session()?.token || null; },
  isUnlocked() { return !!this._session(); },
  remainingMs() { const s = this._session(); return s ? s.until - Date.now() : 0; },
  lock() { sessionStorage.removeItem(SS_SESS); },

  /** 활동 시 세션 시간 연장 (슬라이딩) */
  extend() {
    const s = this._session();
    if (s) this._saveSession(s.token);
  },

  // ══════════════════════════════════════════════
  // 잠금 해제 / 최초 설정
  // ══════════════════════════════════════════════
  /**
   * 입력값으로 잠금 해제. 두 가지 모두 허용:
   *   ① 내가 정한 비밀번호  → 저장된 토큰을 복호화
   *   ② GitHub 토큰 원문     → GitHub API로 즉시 검증 후 사용
   */
  async unlock(input) {
    const val = (input || '').trim();
    if (!val) throw new Error('입력이 비어 있습니다');

    // ① 비밀번호로 저장된 토큰 복호화 시도
    if (this.hasToken()) {
      try {
        const token = await this._decrypt(val);
        if (token) { this._saveSession(token); return token; }
      } catch (_) { /* 비번이 아님 → 아래에서 토큰인지 확인 */ }
    }

    // ② 입력이 토큰 원문인지 확인 (GitHub API로 검증)
    if (this._looksLikeToken(val) && await this._validateToken(val)) {
      this._saveSession(val);
      return val;
    }

    throw new Error('인증 실패');
  },

  /** GitHub 토큰 형태인지 대략 판별 */
  _looksLikeToken(v) {
    return /^(ghp_|github_pat_|gho_|ghs_|ghu_)/.test(v) || v.length >= 40;
  },

  /** 토큰이 실제 유효한지 GitHub API로 확인 */
  async _validateToken(token) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
      });
      return res.ok;
    } catch (_) { return false; }
  },

  async setup(token, password) {
    await this._encrypt(token, password);
    // 게시에 필요한 저장소 정보 기본값 세팅(비어있을 때만)
    if (!localStorage.getItem('gh_owner'))  localStorage.setItem('gh_owner', '0oo0mu');
    if (!localStorage.getItem('gh_repo'))   localStorage.setItem('gh_repo', 'oomu-blog');
    if (!localStorage.getItem('gh_branch')) localStorage.setItem('gh_branch', 'main');
    this._saveSession(token);
  },

  // ══════════════════════════════════════════════
  // 초기화: 잠금화면·세션바 주입 + 게이트
  // ══════════════════════════════════════════════
  init() {
    if (!window.crypto?.subtle) {
      alert('이 브라우저/환경에서는 보안 저장(Web Crypto)이 지원되지 않습니다.\nhttps 또는 localhost에서 에디터를 열어주세요.');
      return;
    }
    this._injectOverlay();
    this._injectSessionBar();
    this._bindActivity();
    this._gate();
    // 1초마다 남은 시간 표시 갱신 + 만료 시 잠금
    this._tickTimer = setInterval(() => this._tick(), 1000);
  },

  _gate() {
    if (this.isUnlocked()) this._reveal();
    else this._showOverlay();
  },

  _tick() {
    const bar = document.getElementById('authSessionBar');
    if (this.isUnlocked()) {
      const ms = this.remainingMs();
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const t = document.getElementById('authRemain');
      if (t) t.textContent = `${m}:${String(s).padStart(2, '0')}`;
      if (bar) bar.style.display = 'flex';
    } else {
      if (bar) bar.style.display = 'none';
      // 방금 만료됐다면 잠금화면 다시 표시
      if (document.getElementById('authOverlay')?.style.display === 'none') {
        this._showOverlay();
      }
    }
  },

  /** 입력/클릭 등 활동이 있으면 세션 자동 연장 (300ms 스로틀) */
  _bindActivity() {
    let last = 0;
    const onAct = () => {
      if (!this.isUnlocked()) return;
      const now = Date.now();
      if (now - last > 300) { last = now; this.extend(); }
    };
    ['keydown', 'input', 'click', 'mousemove', 'touchstart'].forEach(ev =>
      document.addEventListener(ev, onAct, { passive: true })
    );
  },

  _reveal() {
    const ov = document.getElementById('authOverlay');
    if (ov) ov.style.display = 'none';
    this.extend();
  },

  _showOverlay() {
    const ov = document.getElementById('authOverlay');
    if (!ov) return;
    ov.style.display = 'flex';
    // 모드 전환: 토큰 있으면 잠금해제, 없으면 최초 설정
    const setup = !this.hasToken();
    ov.querySelector('#authSetup').style.display  = setup ? 'block' : 'none';
    ov.querySelector('#authUnlock').style.display = setup ? 'none'  : 'block';
    const focusEl = setup ? ov.querySelector('#authNewPw') : ov.querySelector('#authPw');
    setTimeout(() => focusEl?.focus(), 50);
  },

  _err(msg) {
    const e = document.getElementById('authError');
    if (e) { e.textContent = msg; e.style.display = msg ? 'block' : 'none'; }
  },

  // ── 잠금화면 DOM 주입 ──
  _injectOverlay() {
    if (document.getElementById('authOverlay')) return;
    const el = document.createElement('div');
    el.id = 'authOverlay';
    el.innerHTML = `
      <div class="auth-box">
        <div class="auth-title">🔒 에디터 잠금</div>

        <div id="authUnlock">
          <p class="auth-desc">비밀번호 또는 GitHub 토큰으로 잠금을 해제하세요.</p>
          <input type="password" id="authPw" class="auth-input" placeholder="비밀번호 또는 GitHub 토큰" autocomplete="off" />
          <button id="authUnlockBtn" class="auth-btn">잠금 해제</button>
          <button id="authResetBtn" class="auth-link">토큰 다시 설정</button>
        </div>

        <div id="authSetup" style="display:none">
          <p class="auth-desc">
            최초 1회 설정입니다. GitHub 토큰을 한 번 붙여넣고, 앞으로 쓸 비밀번호를 정하세요.
            토큰은 비밀번호로 암호화되어 이 브라우저에만 저장됩니다.
          </p>
          <input type="password" id="authToken" class="auth-input" placeholder="GitHub 토큰 (ghp_...)" autocomplete="off" />
          <input type="password" id="authNewPw" class="auth-input" placeholder="새 비밀번호 (내가 정함)" autocomplete="off" />
          <input type="password" id="authNewPw2" class="auth-input" placeholder="비밀번호 확인" autocomplete="off" />
          <button id="authSetupBtn" class="auth-btn">설정하고 잠금 해제</button>
          <a class="auth-link" href="https://github.com/settings/tokens/new?scopes=repo&description=Blog+Editor" target="_blank" rel="noopener">토큰 발급 방법 →</a>
        </div>

        <div id="authError" class="auth-error" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(el);

    // 잠금 해제
    const doUnlock = async () => {
      this._err('');
      const pw = document.getElementById('authPw').value;
      if (!pw) return;
      try {
        await this.unlock(pw);
        document.getElementById('authPw').value = '';
        this._reveal();
      } catch (_) {
        this._err('비밀번호 또는 토큰이 올바르지 않습니다.');
      }
    };
    el.querySelector('#authUnlockBtn').addEventListener('click', doUnlock);
    el.querySelector('#authPw').addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); });

    // 최초 설정
    el.querySelector('#authSetupBtn').addEventListener('click', async () => {
      this._err('');
      const token = document.getElementById('authToken').value.trim();
      const pw    = document.getElementById('authNewPw').value;
      const pw2   = document.getElementById('authNewPw2').value;
      if (!token) return this._err('GitHub 토큰을 입력하세요.');
      if (pw.length < 4) return this._err('비밀번호는 4자 이상으로 정하세요.');
      if (pw !== pw2) return this._err('비밀번호 확인이 일치하지 않습니다.');
      try {
        await this.setup(token, pw);
        ['authToken', 'authNewPw', 'authNewPw2'].forEach(id => document.getElementById(id).value = '');
        this._reveal();
      } catch (e) {
        this._err('설정 실패: ' + e.message);
      }
    });

    // 토큰 다시 설정
    el.querySelector('#authResetBtn').addEventListener('click', () => {
      if (confirm('저장된 토큰을 지우고 다시 설정할까요?')) {
        this.reset();
        this._showOverlay();
      }
    });
  },

  // ── 세션바(남은시간 + 연장 + 잠금) 주입 ──
  _injectSessionBar() {
    if (document.getElementById('authSessionBar')) return;
    const bar = document.createElement('div');
    bar.id = 'authSessionBar';
    bar.style.display = 'none';
    bar.innerHTML = `
      <span class="auth-remain-wrap">🔓 <span id="authRemain">10:00</span></span>
      <button id="authRenewBtn" class="auth-mini-btn" title="세션 연장">연장</button>
      <button id="authLockBtn" class="auth-mini-btn" title="지금 잠그기">잠금</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('#authRenewBtn').addEventListener('click', () => this.extend());
    bar.querySelector('#authLockBtn').addEventListener('click', () => { this.lock(); this._showOverlay(); this._tick(); });
  },
};

window.EditorAuth = EditorAuth;
export default EditorAuth;
````

