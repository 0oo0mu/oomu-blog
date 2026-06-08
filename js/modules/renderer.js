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
