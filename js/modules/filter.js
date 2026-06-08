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

    const tags = ['all', ...new Set(this._allPosts.flatMap(p => p.tags || []))];

    container.innerHTML = tags.map(tag => `
      <button class="chip ${tag === this.state.tag ? 'active' : ''}"
              data-value="${tag}">
        ${tag === 'all' ? '전체' : '#' + tag}
      </button>
    `).join('');

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      this.state.tag = btn.dataset.value;
      this._applyFilter();
    });
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
   * 현재 필터 상태(카테고리 + 태그 + 검색어)로 포스트를 걸러냅니다.
   * 세 조건을 모두 AND로 적용합니다.
   */
  _applyFilter() {
    const { category, tag, query } = this.state;

    const filtered = this._allPosts.filter(post => {
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
