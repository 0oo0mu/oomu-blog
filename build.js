/**
 * build.js — 배포 전 빌드 스크립트
 *
 * 실행: node build.js
 * npm 스크립트: npm run build
 *
 * 하는 일:
 *   1. blog.config.json 읽기
 *   2. posts/ 폴더를 재귀 탐색해서 .md 파일 목록 수집
 *   3. 각 파일의 Front Matter 파싱
 *   4. posts/posts.json 생성 (블로그 목록 데이터)
 *   5. sitemap.xml 생성 (SEO용)
 *   6. robots.txt 생성 (SEO용)
 *   7. js/core/config.js 생성 (프론트엔드가 사용하는 설정)
 */

const fs   = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════
// [0] 설정 읽기
// ══════════════════════════════════════════════════════

/**
 * blog.config.json을 읽어서 사이트 설정을 가져옵니다.
 * 파일이 없으면 기본값을 사용합니다.
 */
const configPath = path.join(__dirname, 'blog.config.json');
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  : { siteName: 'My Blog', siteUrl: '', description: '', author: '' };

const POSTS_DIR = path.join(__dirname, 'posts');
const OUTPUT    = path.join(POSTS_DIR, 'posts.json');

// ══════════════════════════════════════════════════════
// [1] 폴더 재귀 탐색
// ══════════════════════════════════════════════════════

/**
 * 디렉토리를 재귀적으로 탐색해서 .md 파일 경로를 모두 반환합니다.
 *
 * @param {string} dir     - 탐색할 디렉토리 절대 경로
 * @param {string} baseDir - 기준 디렉토리 (상대 경로 계산용)
 * @returns {string[]}     - posts/ 기준 상대 경로 배열
 */
function findMarkdownFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files   = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Windows 경로 구분자(\)를 슬래시(/)로 통일
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(rel);
    }
  }

  return files;
}

/**
 * posts/ 아래의 모든 하위 폴더 경로를 반환합니다. (글이 없는 빈 폴더도 포함)
 * → 게시글이 하나도 없어도 카테고리(폴더)를 사이드바에 표시하기 위한 목록.
 */
function findCategoryDirs(dir, baseDir = dir) {
  const dirs = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      dirs.push(rel);
      dirs.push(...findCategoryDirs(fullPath, baseDir));
    }
  }
  return dirs;
}

// ══════════════════════════════════════════════════════
// [2] Front Matter 파싱
// ══════════════════════════════════════════════════════

/**
 * .md 파일의 Front Matter(--- 구간)를 파싱합니다.
 *
 * @param {string} raw - 파일 전체 텍스트
 * @returns {{ meta: Object, content: string }}
 */
function parseFrontMatter(raw) {
  const meta  = {};
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta, content: raw };

  match[1].split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (key === 'tags') {
      meta.tags = val.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean);
    } else {
      meta[key] = val;
    }
  });

  return { meta, content: match[2] };
}

// ══════════════════════════════════════════════════════
// [3] 카테고리 자동 추출 (폴더 경로 기반)
// ══════════════════════════════════════════════════════

/**
 * 파일 상대 경로에서 카테고리를 추출합니다.
 * 파일명을 제외한 폴더 경로를 카테고리로 씁니다.
 *
 * 예: '개발/javascript/hello.md' → '개발/javascript'
 *
 * @param {string} relPath - posts/ 기준 상대 경로
 * @returns {string}
 */
function extractCategory(relPath) {
  const parts = relPath.split('/');
  parts.pop(); // 파일명 제거
  return parts.join('/');
}

// ══════════════════════════════════════════════════════
// [4] excerpt 자동 생성
// ══════════════════════════════════════════════════════

/**
 * 마크다운 본문에서 마크다운 기호를 제거하고 첫 150자를 추출합니다.
 *
 * @param {string} content - 본문 텍스트
 * @param {number} maxLen  - 최대 글자 수 (기본 150)
 * @returns {string}
 */
function generateExcerpt(content, maxLen = 150) {
  const plain = content
    .replace(/^#+\s+/gm, '')               // 헤딩 제거
    .replace(/[*_`>~]/g, '')               // 강조/코드/인용 기호 제거
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 링크 → 텍스트
    .replace(/\n+/g, ' ')                  // 줄바꿈 → 공백
    .trim();

  return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain;
}

// ══════════════════════════════════════════════════════
// [5] sitemap.xml 생성
// ══════════════════════════════════════════════════════

/**
 * SEO를 위한 sitemap.xml을 생성합니다.
 * blog.config.json의 siteUrl이 없으면 생성하지 않습니다.
 *
 * @param {Post[]} posts - 전체 포스트 배열
 */
function generateSitemap(posts) {
  const { siteUrl } = config;
  if (!siteUrl || siteUrl === 'https://yourblog.com') {
    console.log('  ⚠️  sitemap.xml 건너뜀 (blog.config.json의 siteUrl을 설정하세요)');
    return;
  }

  // XML 특수문자 이스케이프
  const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const urls = [
    // 메인 페이지
    `  <url>
    <loc>${escape(siteUrl)}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
    // 각 포스트 페이지
    ...posts.map(post => `  <url>
    <loc>${escape(siteUrl)}/post.html?file=${encodeURIComponent(post.file)}</loc>
    <lastmod>${post.date || new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml, 'utf-8');
  console.log('  ✅ sitemap.xml 생성됨');
}

// ══════════════════════════════════════════════════════
// [6] robots.txt 생성
// ══════════════════════════════════════════════════════

/**
 * 검색엔진 크롤러를 위한 robots.txt를 생성합니다.
 */
function generateRobots() {
  const { siteUrl } = config;
  const sitemapLine = (siteUrl && siteUrl !== 'https://yourblog.com')
    ? `Sitemap: ${siteUrl}/sitemap.xml`
    : '# Sitemap: (blog.config.json의 siteUrl을 설정하면 자동으로 추가됩니다)';

  const txt = `User-agent: *
Allow: /
Disallow: /posts/

${sitemapLine}
`;

  fs.writeFileSync(path.join(__dirname, 'robots.txt'), txt, 'utf-8');
  console.log('  ✅ robots.txt 생성됨');
}

// ══════════════════════════════════════════════════════
// [7] js/core/config.js 생성 (프론트엔드용)
// ══════════════════════════════════════════════════════

/**
 * blog.config.json 내용을 ES Module 형태로 변환해서
 * js/core/config.js 에 저장합니다.
 *
 * 이 파일을 수동으로 편집하지 마세요.
 * blog.config.json을 수정하고 node build.js를 실행하세요.
 */
function generateFrontendConfig() {
  // _comment 키는 프론트엔드에 노출하지 않음
  const { _comment, ...exportConfig } = config;

  const js = `// ⚠️ 이 파일은 build.js가 blog.config.json을 읽어서 자동 생성합니다.
// 직접 수정하지 말고, blog.config.json을 수정 후 node build.js를 실행하세요.
const Config = ${JSON.stringify(exportConfig, null, 2)};
export default Config;
`;

  const outPath = path.join(__dirname, 'js', 'core', 'config.js');
  fs.writeFileSync(outPath, js, 'utf-8');
  console.log('  ✅ js/core/config.js 생성됨');
}

// ══════════════════════════════════════════════════════
// [8] playlist.json 자동 생성
// ══════════════════════════════════════════════════════

/**
 * music/ 폴더를 스캔해서 playlist.json을 자동 생성합니다.
 * 파일명에서 확장자를 제거한 값을 제목으로 사용합니다.
 */
function generatePlaylist() {
  const musicDir      = path.join(__dirname, 'music');
  const playlistPath  = path.join(musicDir, 'playlist.json');
  const audioExts     = ['.mp3', '.ogg', '.wav', '.flac', '.m4a'];

  if (!fs.existsSync(musicDir)) {
    console.log('  ⚠️  music/ 폴더 없음 — playlist.json 건너뜀');
    return;
  }

  const files = fs.readdirSync(musicDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return audioExts.includes(ext);
  });

  const playlist = files.map(f => ({
    title: path.basename(f, path.extname(f)),
    file:  'music/' + f,
  }));

  fs.writeFileSync(playlistPath, JSON.stringify(playlist, null, 2), 'utf-8');
  console.log(`  ✅ music/playlist.json 생성됨 (${playlist.length}곡)`);
}

// ══════════════════════════════════════════════════════
// [9] 메인 실행
// ══════════════════════════════════════════════════════

const _siteName = config.siteName || 'Blog';
console.log('\n[Build] Starting: ' + _siteName + '\n');

// 포스트 스캔
console.log('posts/ 폴더 스캔 중...');
const mdFiles = findMarkdownFiles(POSTS_DIR);

if (mdFiles.length === 0) {
  console.warn('Warning: .md 파일을 찾을 수 없습니다.');
}

const posts = [];

for (const relPath of mdFiles) {
  const fullPath = path.join(POSTS_DIR, relPath);
  let raw;
  try {
    raw = fs.readFileSync(fullPath, 'utf-8');
  } catch (e) {
    console.warn('  SKIP (read error): ' + relPath);
    continue;
  }
  const { meta, content } = parseFrontMatter(raw);

  const title    = meta.title    || path.basename(relPath, '.md');
  const category = meta.category || extractCategory(relPath);
  const excerpt  = meta.excerpt  || generateExcerpt(content);

  posts.push({ file: relPath, title, date: meta.date || '', category, tags: meta.tags || [], excerpt });
  console.log('  OK: ' + relPath + (category ? ' (' + category + ')' : ''));
}

// 날짜 내림차순 정렬
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

// posts.json 저장
fs.writeFileSync(OUTPUT, JSON.stringify(posts, null, 2), 'utf-8');
console.log('\nposts/posts.json 생성됨 (' + posts.length + '개 포스트)');

// categories.json 저장 — 폴더 기반 전체 카테고리(빈 폴더 포함)
const categoryDirs = findCategoryDirs(POSTS_DIR);

// 빈 카테고리 폴더에 .gitkeep 생성
// git은 빈 폴더를 추적하지 않으므로, 파일이 하나도 없는 폴더에 빈 .gitkeep을 넣어
// 저장소에 폴더가 포함되게 하고 배포 시에도 카테고리로 유지되도록 합니다.
categoryDirs.forEach(rel => {
  const abs = path.join(POSTS_DIR, rel);
  const hasFile = fs.readdirSync(abs, { withFileTypes: true }).some(e => e.isFile());
  if (!hasFile) {
    fs.writeFileSync(path.join(abs, '.gitkeep'), '', 'utf-8');
    console.log('  ✅ .gitkeep 생성: posts/' + rel + ' (빈 카테고리 유지용)');
  }
});
fs.writeFileSync(
  path.join(POSTS_DIR, 'categories.json'),
  JSON.stringify(categoryDirs, null, 2),
  'utf-8'
);
console.log('posts/categories.json 생성됨 (' + categoryDirs.length + '개 폴더)');

// 부가 파일 생성
console.log('\n부가 파일 생성 중...');
generateSitemap(posts);
generateRobots();
generateFrontendConfig();
generatePlaylist();

console.log("[Build] Done!");
