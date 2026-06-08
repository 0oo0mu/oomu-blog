---
title: "[코드 해설 14] markdown.js — 마크다운을 HTML로 변환하기"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, 마크다운, 파싱]
excerpt: 글 파일(.md)을 HTML로 변환하고, 맨 위의 --- 구간(Front Matter)에서 제목·날짜·태그를 뽑아내는 방법을 한 줄씩 설명합니다.
---

# markdown.js — 마크다운을 HTML로 변환하기

## 마크다운이란

마크다운은 간단한 기호로 서식을 표현하는 형식입니다.

```markdown
# 제목
**굵게**
- 목록 항목
```

이게 HTML로 변환되면:
```html
<h1>제목</h1>
<strong>굵게</strong>
<ul><li>목록 항목</li></ul>
```

직접 HTML을 쓰는 것보다 글쓰기가 훨씬 편합니다.

---

## Front Matter란

글 파일 맨 위에 `---`로 감싼 구간입니다.

```markdown
---
title: 내 첫 글
date: 2026-06-01
category: 개발
tags: [JavaScript, CSS]
excerpt: 첫 번째 글 요약입니다.
---

# 여기서부터 본문 시작

실제 글 내용...
```

제목, 날짜, 카테고리, 태그, 요약 같은 **메타데이터**를 구조화해서 저장합니다.
markdown.js의 `parseFrontMatter`가 이 부분을 파싱합니다.

---

## 전체 코드

```js
const Markdown = {
  parse(mdText) {
    if (typeof window.marked === 'undefined') {
      console.error('[Markdown] marked.js가 로드되지 않았습니다.');
      return `<p>마크다운 파서를 불러올 수 없습니다.</p>`;
    }
    return window.marked.parse(mdText);
  },

  parseFrontMatter(raw) {
    const meta = {};

    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta, content: raw };

    match[1].split('\n').forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return;

      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();

      if (key === 'tags') {
        meta.tags = val
          .replace(/[\[\]]/g, '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
      } else {
        meta[key] = val;
      }
    });

    return { meta, content: match[2] };
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if (window.marked) {
      window.marked.setOptions({
        gfm:    true,
        breaks: true,
      });
    }
  });
}

export default Markdown;
```

---

## 한 줄씩 설명

### `parse` — 마크다운 → HTML 변환

```js
parse(mdText) {
  if (typeof window.marked === 'undefined') {
    console.error('[Markdown] marked.js가 로드되지 않았습니다.');
    return `<p>마크다운 파서를 불러올 수 없습니다.</p>`;
  }
  return window.marked.parse(mdText);
},
```

`marked.js`는 CDN(외부 서버)에서 불러오는 라이브러리입니다.
```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

이것이 로드되면 `window.marked`가 생깁니다.
`typeof window.marked === 'undefined'`는 "marked가 아직 없으면"입니다.
없으면 오류 메시지를 반환하고, 있으면 `marked.parse()`로 변환합니다.

---

### `parseFrontMatter` — Front Matter 파싱

#### 정규표현식으로 구간 찾기

```js
const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
```

정규표현식 분해:

| 부분 | 의미 |
|---|---|
| `^` | 문자열 시작 |
| `---\n` | `---` 다음 줄바꿈 |
| `([\s\S]*?)` | 캡처 그룹1: `\s`(공백/줄바꿈) + `\S`(그 외) = 어떤 문자든. `*?`는 최소 매칭 |
| `\n---\n` | 줄바꿈 + `---` + 줄바꿈 |
| `([\s\S]*)` | 캡처 그룹2: 나머지 전부 |
| `$` | 문자열 끝 |

`match`가 null이면 Front Matter가 없는 파일. `{ meta: {}, content: raw }`를 반환합니다.
있으면:
- `match[1]` = `---` 안의 메타데이터 텍스트
- `match[2]` = 본문

---

#### 메타데이터 파싱

```js
match[1].split('\n').forEach(line => {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return;
```

`match[1]`은 이런 문자열입니다:
```
title: 내 첫 글
date: 2026-06-01
tags: [JavaScript, CSS]
```

`.split('\n')`으로 줄별로 나눕니다: `['title: 내 첫 글', 'date: 2026-06-01', ...]`
각 줄에서 `:` 위치를 찾습니다. `indexOf`는 없으면 -1을 반환합니다.
`colonIdx === -1`이면 `return`으로 이 줄을 건너뜁니다.

```js
  const key = line.slice(0, colonIdx).trim();
  const val = line.slice(colonIdx + 1).trim();
```

`line = 'title: 내 첫 글'`, `colonIdx = 5` (`:` 위치)라면:
- `line.slice(0, 5)` → `'title'` → trim → `'title'`
- `line.slice(6)` → `' 내 첫 글'` → trim → `'내 첫 글'`

`colonIdx + 1`인 이유: `:` 자체는 포함하지 않으려고.

---

#### 태그 파싱

```js
if (key === 'tags') {
  meta.tags = val
    .replace(/[\[\]]/g, '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}
```

태그는 두 가지 형식을 지원합니다.
- `[JavaScript, CSS]` (배열 형식)
- `JavaScript, CSS` (쉼표 구분)

**`.replace(/[\[\]]/g, '')`**
`[` 와 `]`를 제거합니다. `[\[\]]`는 문자 클래스에서 이스케이프된 대괄호.
`[JavaScript, CSS]` → `JavaScript, CSS`

**`.split(',')`**
쉼표로 분리합니다: `['JavaScript', ' CSS']`

**`.map(t => t.trim())`**
각 태그 앞뒤 공백 제거: `['JavaScript', 'CSS']`

**`.filter(Boolean)`**
빈 문자열 제거 (태그 뒤에 실수로 쉼표가 있을 때 발생 가능).

---

#### 일반 키

```js
} else {
  meta[key] = val;
}
```

태그가 아닌 다른 키는 문자열 그대로 저장합니다.
`meta['title'] = '내 첫 글'`

---

### marked.js 옵션 설정

```js
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if (window.marked) {
      window.marked.setOptions({
        gfm:    true,  // GitHub Flavored Markdown (표, 취소선 등)
        breaks: true,  // 줄바꿈(\n)을 <br>로 변환
      });
    }
  });
}
```

**`typeof window !== 'undefined'`**
브라우저 환경인지 확인합니다. Node.js(build.js)에서는 `window`가 없습니다.
이 파일이 혹시 서버사이드에서 import될 때 오류를 막습니다.

**`gfm: true`**
GitHub에서 쓰는 마크다운 확장 문법을 지원합니다.
| 테이블, ~~취소선~~, ```코드 블록``` 등이 여기에 포함됩니다.

**`breaks: true`**
줄바꿈 하나를 `<br>`로 변환합니다. 기본값은 두 줄바꿈(빈 줄)이 있어야 단락이 나뉩니다.

---

## 실제 사용 흐름

```js
// app-post.js에서 (글 상세 페이지)
const res = await fetch(`posts/${file}`);
const raw = await res.text();

const { meta, content } = Markdown.parseFrontMatter(raw);
// meta: { title: '...', date: '...', tags: [...] }
// content: Front Matter 제외한 본문 마크다운

const html = Markdown.parse(content);
// html: '<h1>...</h1><p>...</p>...'

document.getElementById('postBody').innerHTML = html;
```

---

## 다음 파일

- **[15] build.js** — posts.json, sitemap.xml을 자동 생성하는 빌드 스크립트
