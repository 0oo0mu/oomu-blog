# Blog (개인 블로그)

정적 블로그 — Node.js 빌드 스크립트(`build.js`) + 순수 HTML/CSS/JS, 백엔드 없음.

- 배포: GitHub Pages (https://0oo0mu.github.io/oomu-blog/), 저장소 https://github.com/0oo0mu/oomu-blog.git
- 배포 방법: `deploy.bat` 실행 → `build.js`가 `posts/`를 스캔해 `posts/posts.json` 생성 → git add/commit/push

## 구조
- `index.html`: SPA 메인(목록+포스트 뷰 전환), `post.html`: standalone 포스트 페이지, `editor.html`: 로컬 전용 글쓰기
- `js/core/`: app.js(이벤트버스), router.js(SPA), theme.js, accent.js
- `js/modules/`: sidebar.js, filter.js, graph.js(D3 그래프), markdown.js
- `css/`: variables.css에 전체 색상/크기 변수 정의
- `posts/`: `posts.json`(자동 생성, 직접 수정 금지), `개발/블로그코드`(16개), `개발/품질검사시스템`(11개), `언어/`(c-basics.md, java-basics.md)

## 핵심 주의사항
- SPA 라우팅은 `index.html?file=경로/파일.md`. **`Router.init()`은 반드시 `App.on('router:post', ...)` 등록 이후에 호출**해야 F5 새로고침이 정상 동작 (과거 버그, 수정 완료 — 되돌리지 말 것)
- Front Matter는 `---\n...\n---` 형식. `title:` 값에 큰따옴표 쓰면 UI에 그대로 노출되므로 따옴표 없이 작성
- 그래프(D3)는 CDN 동적 로드(`_loadD3()`). SVG fill/stroke는 `.style()` 사용 — `.attr()`은 CSS 변수 미적용됨

## 게시글 작성 포맷
```
title: 제목 (따옴표 없이)
date: 2026-06-22
category: 개발/품질검사시스템
tags: [태그1, 태그2]
excerpt: 한 줄 요약
```

## 미완료 / TODO
- 일일 퀘스트(체크리스트) 기능: 다른 기기 동기화하려면 Supabase DB 재연동 필요(로그인 기능은 현재 제거된 상태)
- `blog.config.json`의 `siteUrl`이 아직 기본값(`https://yourblog.com`) — 실제 주소로 바꾸면 sitemap.xml 생성됨
- 미니 그래프 노드 표시 방식 계속 튜닝 중

원본 상세 메모: `블로그컨텍스트.txt` (이 파일과 함께 유지)
