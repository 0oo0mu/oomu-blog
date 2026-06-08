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
if (writeBtn && !Env.isLocal) {
  writeBtn.style.display = 'none';
}

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
