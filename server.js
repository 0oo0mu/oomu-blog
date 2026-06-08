/**
 * server.js — 로컬 개발 서버
 *
 * 사용법:
 *   node server.js
 *
 * 실행 후 브라우저에서 http://localhost:3000 을 열어주세요.
 *
 * 왜 필요한가?
 *   index.html을 파일 탐색기에서 직접 열면 file:// 프로토콜로 실행됩니다.
 *   이 경우 브라우저 보안 정책으로 인해 두 가지가 차단됩니다:
 *     1. fetch() - posts.json, .md 파일을 불러오지 못함
 *     2. ES 모듈 (import/export) - JS 파일 간 연결이 끊김
 *   로컬 서버를 통해 http://localhost 로 열면 이 문제가 없습니다.
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');
const { exec, execSync } = require('child_process');

const PORT    = 3000;
const ROOT    = __dirname; // 블로그 루트 폴더 (server.js가 있는 곳)
const OPEN_IN_BROWSER = true; // 서버 시작 시 브라우저 자동 열기

// 확장자 → Content-Type 매핑
const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.md':    'text/plain; charset=utf-8',
  '.mp3':   'audio/mpeg',
  '.ogg':   'audio/ogg',
  '.wav':   'audio/wav',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.webp':  'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
};

// ── HTTP 서버 생성 ──
const server = http.createServer((req, res) => {
  // URL 파싱: 쿼리스트링(?file=...)은 무시하고 경로만 사용
  const parsedUrl = url.parse(req.url);
  let pathname    = decodeURIComponent(parsedUrl.pathname);

  // '/'로 접근하면 index.html 제공
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(ROOT, pathname);

  // 보안: ROOT 폴더 밖으로 나가는 경로 차단 (path traversal 방지)
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  const ext         = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  // 파일 읽기
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // 파일이 없으면 404
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${pathname}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
        console.error('[서버 오류]', err);
      }
      return;
    }

    // CORS 헤더 추가 (로컬 환경에서 외부 API 테스트 시 필요)
    res.writeHead(200, {
      'Content-Type':  contentType,
      'Cache-Control': 'no-cache',            // 개발 중엔 캐시 사용 안 함
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});

// ── 서버 시작 ──
server.listen(PORT, '127.0.0.1', () => {
  const addr = `http://localhost:${PORT}`;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║        🚀 블로그 서버 실행 중!        ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  주소:  ${addr}             ║`);
  console.log('║  종료:  Ctrl + C                     ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 브라우저 자동 열기 (운영체제별 명령어가 다름)
  if (OPEN_IN_BROWSER) {
    const { exec } = require('child_process');
    const cmd =
      process.platform === 'win32'  ? `start ${addr}` :    // Windows
      process.platform === 'darwin' ? `open ${addr}`  :    // macOS
                                      `xdg-open ${addr}`;  // Linux
    exec(cmd, err => {
      if (err) console.log(`  브라우저를 직접 열어주세요: ${addr}`);
    });
  }
});

// ══════════════════════════════════════════════════════════
// 자동 빌드: posts/ 폴더의 .md 파일이 변경되면 build.js 자동 실행
//
// 동작 방식:
//   1. fs.watch로 posts/ 폴더 전체를 재귀 감시
//   2. .md 파일 변경 감지 → 300ms 디바운스 → node build.js 실행
//   3. 실행 결과(posts.json 갱신)를 콘솔에 출력
//
// 덕분에:
//   - 새 .md 파일 저장 → posts.json 자동 갱신 → 브라우저 새로고침만 하면 OK
//   - 수동으로 node build.js를 따로 실행할 필요 없음
// ══════════════════════════════════════════════════════════

const POSTS_DIR  = path.join(ROOT, 'posts');
const BUILD_FILE = path.join(ROOT, 'build.js');

// 서버 시작 시 최초 1회 빌드 (posts.json이 최신 상태인지 보장)
try {
  execSync(`node "${BUILD_FILE}"`, { cwd: ROOT, stdio: 'pipe' });
  console.log('✅ 초기 빌드 완료 (posts.json 갱신됨)');
} catch (e) {
  console.warn('⚠️  초기 빌드 실패:', e.message);
}

// 디바운스 타이머: 파일이 연속 저장될 때 build.js가 중복 실행되지 않도록
let _buildTimer = null;

function runBuild(changedFile) {
  clearTimeout(_buildTimer);
  _buildTimer = setTimeout(() => {
    const rel = path.relative(ROOT, changedFile);
    console.log(`\n📝 변경 감지: ${rel}`);
    console.log('   → build.js 실행 중...');

    // 1단계: build.js 실행
    exec(`node "${BUILD_FILE}"`, { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) {
        console.error('   ❌ 빌드 실패:', stderr || err.message);
        return;
      }
      const msg = (stdout || '').split('\n').find(l => l.trim());
      console.log(`   ✅ ${msg || '빌드 완료'}`);

      // 2단계: git push (AUTO_PUSH가 켜져 있을 때만)
      if (!AUTO_PUSH) return;

      console.log('   → GitHub에 자동 업로드 중...');
      const commitMsg = `글 업데이트: ${rel} (${new Date().toLocaleString('ko-KR')})`;
      const gitCmd = [
        'git add .',
        `git commit -m "${commitMsg}"`,
        'git push',
      ].join(' && ');

      exec(gitCmd, { cwd: ROOT }, (gErr, gOut, gStderr) => {
        if (gErr) {
          // "nothing to commit"은 오류가 아님
          if (gStderr && gStderr.includes('nothing to commit')) {
            console.log('   ℹ️  변경사항 없음 (push 건너뜀)');
          } else {
            console.error('   ❌ GitHub 업로드 실패:', gStderr || gErr.message);
          }
        } else {
          console.log('   🚀 GitHub 업로드 완료! 2분 내 블로그에 반영됩니다.');
        }
      });
    });
  }, 1500); // 1.5초 디바운스 (파일 저장 완료 후 여유있게)
}

// ── 자동 push 설정 ──
// true  → .md 저장 시 자동으로 git commit + push
// false → 빌드만 하고 push는 수동으로
const AUTO_PUSH = true;

// posts/ 폴더 재귀 감시
if (fs.existsSync(POSTS_DIR)) {
  fs.watch(POSTS_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;                        // 일부 OS에서 filename이 null
    if (!filename.endsWith('.md')) return;        // .md 파일만 처리
    if (filename.includes('~')) return;           // 임시 파일 무시 (에디터 자동저장)

    const fullPath = path.join(POSTS_DIR, filename);
    runBuild(fullPath);
  });
  console.log(`👀 posts/ 폴더 감시 중 — .md 파일 저장 시 자동 빌드됩니다.\n`);
} else {
  console.warn('⚠️  posts/ 폴더를 찾을 수 없습니다. 자동 빌드가 비활성화됩니다.');
}

// 예상치 못한 에러 처리
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ 포트 ${PORT}가 이미 사용 중입니다.`);
    console.error(`   server.js 파일을 열어서 PORT 값을 3001 등으로 바꿔보세요.\n`);
  } else {
    console.error('\n❌ 서버 오류:', err.message);
  }
  process.exit(1);
});
