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
    App.on('posts:loaded', ({ posts }) => {
      this._allPosts = posts;
      this._build(posts);
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
   */
  _build(posts) {
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
