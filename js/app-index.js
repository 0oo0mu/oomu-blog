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
