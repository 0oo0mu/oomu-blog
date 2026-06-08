---
title: "[코드 해설 15] build.js — posts.json을 자동으로 만드는 빌드 스크립트"
date: 2026-06-02
category: 개발/코드해설
tags: [Node.js, 빌드, 자동화]
excerpt: 새 글을 쓴 후 node build.js를 실행하면 posts.json, sitemap.xml, config.js가 자동 생성됩니다. Node.js 파일 시스템 API와 재귀 탐색을 한 줄씩 설명합니다.
---

# build.js — posts.json을 자동으로 만드는 빌드 스크립트

## 왜 빌드 스크립트가 필요한가

이 블로그는 순수 정적 파일(HTML/CSS/JS)로 만들어져 있습니다.
새 글(`.md` 파일)을 추가해도 서버가 없어서 파일 목록을 자동으로 알 수 없습니다.

해결책: **배포 전에 한 번** Node.js 스크립트를 실행해서
`posts/posts.json`을 미리 만들어두면, 브라우저가 이 파일만 fetch하면 됩니다.

```
새 글 작성 (posts/개발/hello.md)
         │
         ▼
node build.js 실행
         │
         ▼
posts/posts.json 갱신 ← 브라우저가 이걸 fetch
sitemap.xml 생성     ← 구글 검색 노출용
robots.txt 생성      ← 검색엔진 크롤링 설정
js/core/config.js 생성 ← 프론트엔드 설정
```

---

## 전체 코드 (주요 부분)

```js
const fs   = require('fs');
const path = require('path');

// 설정 읽기
const configPath = path.join(__dirname, 'blog.config.json');
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  : { siteName: 'My Blog', siteUrl: '', description: '', author: '' };

const POSTS_DIR = path.join(__dirname, 'posts');
const OUTPUT    = path.join(POSTS_DIR, 'posts.json');

// 마크다운 파일 탐색 (재귀)
function findMarkdownFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files   = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(rel);
    }
  }
  return files;
}

// Front Matter 파싱
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
      meta.tags = val.replace(/[\[\]]/g,'').split(',').map(t=>t.trim()).filter(Boolean);
    } else {
      meta[key] = val;
    }
  });

  return { meta, content: match[2] };
}

// 포스트 데이터 수집
const mdFiles = findMarkdownFiles(POSTS_DIR);
const posts   = [];

for (const relPath of mdFiles) {
  const fullPath = path.join(POSTS_DIR, relPath);
  const raw      = fs.readFileSync(fullPath, 'utf-8');
  const { meta } = parseFrontMatter(raw);

  if (!meta.title) continue;

  const fileParts = relPath.replace(/\.md$/, '').split('/');
  fileParts.pop();
  const category = fileParts.join('/') || meta.category || '';

  posts.push({
    file:     relPath,
    title:    meta.title    || '',
    date:     meta.date     || '',
    category: meta.category || category,
    tags:     meta.tags     || [],
    excerpt:  meta.excerpt  || '',
  });
}

// 날짜 내림차순 정렬
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

// posts.json 저장
fs.writeFileSync(OUTPUT, JSON.stringify(posts, null, 2), 'utf-8');
console.log(`✅ posts.json 생성 완료 (${posts.length}개)`);
```

---

## 한 줄씩 설명

### Node.js 모듈 불러오기

```js
const fs   = require('fs');
const path = require('path');
```

`require`는 Node.js에서 모듈을 불러오는 방법입니다. (브라우저의 `import`와 다릅니다)

**`fs`** (File System): 파일 읽기, 쓰기, 목록 조회 등 파일 관련 기능.
**`path`**: 파일 경로를 다루는 도구. 운영체제마다 다른 경로 구분자(`\` vs `/`)를 처리해줍니다.

---

### 설정 파일 읽기

```js
const configPath = path.join(__dirname, 'blog.config.json');
```

**`__dirname`**: 현재 파일(build.js)이 있는 폴더의 절대 경로.
**`path.join`**: 경로를 안전하게 합칩니다. Windows(`\`)와 Mac/Linux(`/`)를 모두 처리합니다.

```js
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  : { siteName: 'My Blog', ... };
```

**`fs.existsSync(경로)`**: 파일이 존재하면 `true`, 없으면 `false`.
**`fs.readFileSync(경로, 'utf-8')`**: 파일을 동기적으로 읽어서 문자열로 반환.
`'utf-8'`은 인코딩 방식입니다. 한글을 올바르게 읽으려면 명시해야 합니다.

---

### `findMarkdownFiles` — 폴더 재귀 탐색

```js
function findMarkdownFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files   = [];
```

**`fs.readdirSync(dir, { withFileTypes: true })`**
폴더 안의 항목들을 읽습니다.
`{ withFileTypes: true }`를 주면 파일인지 폴더인지 구분할 수 있는 `Dirent` 객체를 반환합니다.

```js
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath, baseDir));  // 재귀!
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(rel);
    }
  }
```

**`entry.isDirectory()`**: 이 항목이 폴더면 `true`.
폴더면 → 그 폴더 안으로 들어가서 다시 탐색합니다 (재귀).

**`entry.name.endsWith('.md')`**: 파일 이름이 `.md`로 끝나면 true.

**`path.relative(baseDir, fullPath)`**
`baseDir`을 기준으로 `fullPath`의 상대 경로를 만듭니다.
예: baseDir=`/blog/posts`, fullPath=`/blog/posts/PC/언어/c-basics.md`
→ `'PC/언어/c-basics.md'` (또는 Windows에서 `'PC\\언어\\c-basics.md'`)

**`.replace(/\\/g, '/')`**
Windows의 `\`를 `/`로 통일합니다. 코드를 OS에 관계없이 동작하게 합니다.

**`files.push(...findMarkdownFiles(...))`**
`...`(스프레드)로 재귀 결과 배열을 펼쳐서 `files`에 추가합니다.
`push([...])`하면 배열이 배열 안에 들어가지만, `push(...[...])`하면 개별 항목들이 추가됩니다.

---

### 포스트 데이터 수집

```js
for (const relPath of mdFiles) {
  const fullPath = path.join(POSTS_DIR, relPath);
  const raw      = fs.readFileSync(fullPath, 'utf-8');
  const { meta } = parseFrontMatter(raw);

  if (!meta.title) continue;
```

`if (!meta.title) continue`는 제목이 없는 파일(Front Matter가 없거나 title이 없는)을 건너뜁니다.
`continue`는 현재 반복을 건너뛰고 다음 파일로 넘어갑니다.

```js
  const fileParts = relPath.replace(/\.md$/, '').split('/');
  fileParts.pop();
  const category = fileParts.join('/') || meta.category || '';
```

파일 경로에서 카테고리를 자동 추출합니다.

예: `relPath = 'PC/언어/c-basics.md'`
1. `.replace(/\.md$/, '')` → `'PC/언어/c-basics'`
2. `.split('/')` → `['PC', '언어', 'c-basics']`
3. `.pop()` → 마지막 요소(파일명) 제거 → `['PC', '언어']`
4. `.join('/')` → `'PC/언어'`

Front Matter에 category가 명시되면 그것을 우선 씁니다 (`meta.category || category`).

---

### `posts.json` 저장

```js
fs.writeFileSync(OUTPUT, JSON.stringify(posts, null, 2), 'utf-8');
```

**`JSON.stringify(posts, null, 2)`**
JavaScript 배열을 JSON 문자열로 변환합니다.
- 첫 번째 인자: 변환할 데이터
- 두 번째 인자: replacer (특별한 처리 없으면 null)
- 세 번째 인자: 들여쓰기 칸 수 (2칸). 사람이 읽기 좋은 형식으로 저장합니다.

**`fs.writeFileSync(경로, 내용, 인코딩)`**
파일에 씁니다. 파일이 없으면 새로 만들고, 있으면 덮어씁니다.

---

## 언제 실행하나

```bash
node build.js
# 또는
npm run build
```

새 글을 추가하거나 기존 글을 수정한 뒤에 실행합니다.
그 다음 변경된 파일들을 GitHub에 push하면 자동으로 배포됩니다.

---

## 다음 파일

- **[전체 연결 구조]** — 모든 파일이 어떻게 연결되는지 한눈에 보기
