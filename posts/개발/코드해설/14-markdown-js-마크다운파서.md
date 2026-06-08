---
title: "[코드 해설 14] markdown.js — 마크다운을 HTML로 변환"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, 마크다운, 정규식]
excerpt: 게시글이 .md 파일로 저장되고 웹에서 읽힐 때 어떤 과정을 거치나요? Front Matter 파싱과 marked.js 래퍼를 설명합니다.
---

## 이 파일이 하는 일

게시글은 `.md`(마크다운) 파일로 저장됩니다.  
브라우저는 마크다운을 모르기 때문에 HTML로 변환해야 해요.

`markdown.js`는 두 가지 작업을 합니다:
1. **Front Matter 파싱** — 파일 맨 위 `---` 블록에서 메타데이터 추출
2. **마크다운 → HTML 변환** — `marked.js` 라이브러리 사용

---

## Front Matter란?

```markdown
---
title: "[코드 해설 01] app.js"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, 설계]
excerpt: 블로그의 모든 기능이 서로 소통하는 방법
---

## 이 파일이 하는 일

본문 내용...
```

파일 맨 위에 `---`로 감싼 영역이 Front Matter입니다.  
제목, 날짜, 카테고리, 태그 같은 **메타데이터**를 저장해요.

---

## parseFrontMatter() — Front Matter 파싱

```javascript
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
```

**정규식 설명:**

```javascript
/^---\n([\s\S]*?)\n---\n([\s\S]*)$/
```

`^` → 문자열 시작  
`---\n` → `---` 다음 줄바꿈  
`([\s\S]*?)` → 어떤 문자든 (공백, 줄바꿈 포함) 최소한으로 매칭 → **그룹 1 = Front Matter 내용**  
`\n---\n` → 닫는 `---`  
`([\s\S]*)` → 나머지 전부 → **그룹 2 = 본문**

`match[1]` = Front Matter 텍스트  
`match[2]` = 본문 마크다운

---

## 각 줄 파싱

```javascript
const colonIdx = line.indexOf(':');
const key = line.slice(0, colonIdx).trim();
const val = line.slice(colonIdx + 1).trim();
```

`"title: 내 첫 글"` 처리:
- `colonIdx` = 5 (`:` 의 위치)
- `key` = `"title"`
- `val` = `"내 첫 글"`

`indexOf(':')` 대신 `split(':')`을 쓰지 않는 이유:  
값에 `:` 이 포함될 수 있어요. 예: `"title: http://example.com"`  
첫 번째 `:` 만 구분자로 쓰도록 `indexOf`를 사용합니다.

---

## 태그 파싱

```javascript
meta.tags = val
  .replace(/[\[\]]/g, '')  // [JS, CSS] → JS, CSS
  .split(',')
  .map(t => t.trim())
  .filter(Boolean);
```

`[JavaScript, 설계, 이벤트]` → `"JavaScript, 설계, 이벤트"` → `["JavaScript", "설계", "이벤트"]`

`filter(Boolean)` → 빈 문자열 제거. 맨 끝에 쉼표가 있어도 안전해요.

---

## parse() — 마크다운 → HTML

```javascript
parse(mdText) {
  if (typeof window.marked === 'undefined') {
    return `<p>마크다운 파서를 불러올 수 없습니다.</p>`;
  }
  return window.marked.parse(mdText);
},
```

`marked.js`는 CDN에서 불러옵니다:
```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

이 라이브러리가 `window.marked` 객체를 만들어줘요.  
`window.marked.parse('# 제목\n본문')` → `'<h1>제목</h1>\n<p>본문</p>'`

---

## marked.js 옵션 설정

```javascript
window.addEventListener('load', () => {
  if (window.marked) {
    window.marked.setOptions({
      gfm:    true, // GitHub Flavored Markdown
      breaks: true, // \n → <br>
    });
  }
});
```

`gfm: true` → GitHub 스타일 마크다운 지원  
표(`| 열1 | 열2 |`), 취소선(`~~취소~~`), 체크박스(`- [x]`) 등

`breaks: true` → 줄바꿈을 `<br>` 태그로 변환  
이게 없으면 줄바꿈을 두 번 해야 단락이 나뉩니다.

---

## 전체 사용 흐름

```javascript
// 1. .md 파일 fetch
const rawText = await fetch('posts/개발/hello.md').then(r => r.text());

// 2. Front Matter 분리
const { meta, content } = Markdown.parseFrontMatter(rawText);
// meta = { title: '...', date: '...', tags: [...] }
// content = 순수 마크다운 본문

// 3. 마크다운 → HTML
const html = Markdown.parse(content);

// 4. DOM에 삽입
document.getElementById('postBody').innerHTML = html;
```
