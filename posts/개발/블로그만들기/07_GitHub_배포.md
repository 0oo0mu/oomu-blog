---
title: [블로그 만들기] 07. GitHub Pages로 무료 배포 — 사이트를 세상에 공개
date: 2026-07-14
category: 개발/블로그만들기
tags: [블로그만들기, Git, GitHub, 배포, GitHubPages]
excerpt: Git이 무엇인지부터 GitHub 저장소 만들기, add·commit·push, GitHub Pages 켜기까지. 내 컴퓨터에만 있던 블로그를 진짜 인터넷 주소로 공개합니다. deploy.bat으로 배포를 한 번에 하는 법도 만듭니다.
---

# GitHub Pages로 무료 배포

지금까지 만든 블로그는 **내 컴퓨터에서만** 볼 수 있었습니다. 이번 편에서 **GitHub Pages**를 이용해, 누구나 접속할 수 있는 진짜 인터넷 주소로 공개합니다. 서버 임대도, 돈도 필요 없습니다.

## Git과 GitHub — 뭐가 다른가

둘 다 이름이 비슷해서 헷갈리지만 다릅니다.

- **Git** — 코드의 **변경 기록을 저장·관리**하는 도구. 내 컴퓨터에서 돌아갑니다. "언제 뭘 바꿨는지" 사진(스냅샷)을 찍어 쌓아둔다고 생각하세요.
- **GitHub** — Git으로 관리한 코드를 **인터넷에 올려 보관·공유**하는 웹사이트. (구글 드라이브의 코드 버전이라고 보면 됩니다.)

우리는 Git으로 블로그 코드를 저장하고, GitHub에 올린 뒤, GitHub의 **Pages** 기능으로 그 코드를 웹사이트로 공개할 겁니다.

## 핵심 용어 4개

- **저장소(repository, 레포)** — 한 프로젝트의 코드와 그 전체 기록을 담는 공간. 우리 `Blog` 폴더 하나가 저장소가 됩니다.
- **커밋(commit)** — 현재 상태를 "찰칵" 찍어 기록으로 남기는 것. 각 커밋엔 설명 메시지를 답니다.
- **원격(remote)** — GitHub에 있는 저장소(내 컴퓨터 밖). `origin`이라는 별명으로 부릅니다.
- **푸시(push)** — 내 컴퓨터의 커밋들을 원격(GitHub)으로 밀어 올리는 것.

흐름을 한 줄로: **파일 수정 → add(담기) → commit(찍기) → push(올리기).**

## 1) GitHub 가입 & 저장소 만들기

1. `github.com` 접속 → **Sign up**으로 가입 (무료). 사용자 이름(username)을 정하는데, 이게 나중에 블로그 주소에 들어갑니다.
2. 로그인 후 오른쪽 위 **+ → New repository**
3. **Repository name**에 `my-blog`처럼 입력
4. **Public**(공개) 선택 — GitHub Pages 무료 배포는 공개 저장소라야 됩니다
5. 나머지는 건드리지 말고 (README 등 체크 해제) **Create repository** 클릭
6. 다음 화면에 나오는 주소(`https://github.com/사용자이름/my-blog.git`)를 복사해둡니다

## 2) Git 첫 설정 (최초 1회)

터미널에서 이름과 이메일을 등록합니다(커밋에 기록될 정보).

```bash
git config --global user.name "내이름"
git config --global user.email "내이메일@example.com"
```

## 3) 내 폴더를 저장소로 만들고 올리기

VS Code 터미널에서 `Blog` 폴더에 있는지 확인하고, 한 줄씩 실행합니다.

```bash
git init
node build.js
git add .
git commit -m "첫 블로그"
git branch -M main
git remote add origin https://github.com/사용자이름/my-blog.git
git push -u origin main
```

한 줄씩 뜻:

- `git init` — 이 폴더를 Git 저장소로 시작. (`.git`이라는 숨김 폴더가 생겨 기록을 저장합니다.)
- `node build.js` — 올리기 전에 `posts.json`을 최신으로.
- `git add .` — 바뀐/새 파일 **전부**를 다음 커밋에 담기. (`.`은 "현재 폴더 전체")
- `git commit -m "첫 블로그"` — 담은 것을 "첫 블로그"라는 메시지로 찰칵.
- `git branch -M main` — 기본 가지(branch) 이름을 `main`으로. (GitHub 기본이 main입니다.)
- `git remote add origin 주소` — GitHub 저장소를 `origin`이라는 별명으로 연결.
- `git push -u origin main` — `main`을 origin으로 밀어 올리기. `-u`는 "앞으로 이 짝을 기본으로 기억해"라는 뜻이라, 다음부턴 `git push`만 쳐도 됩니다.

push할 때 **GitHub 로그인 창**이 뜨면 브라우저로 로그인/승인하세요. (한 번 해두면 이후엔 기억됩니다.)

새로고침해서 GitHub 저장소 페이지를 보면 내 파일들이 올라가 있을 겁니다.

## 4) GitHub Pages 켜기

이제 올린 코드를 웹사이트로 공개합니다.

1. GitHub 저장소 페이지 → 상단 **Settings**
2. 왼쪽 메뉴 **Pages**
3. **Build and deployment → Source**에서 **"Deploy from a branch"** 선택
4. **Branch**를 `main`, 폴더는 `/ (root)`로 두고 **Save**
5. 잠시(1~2분) 기다리면 위쪽에 **`https://사용자이름.github.io/my-blog/`** 주소가 뜹니다

그 주소로 접속하면 — 내 블로그가 **인터넷에 떴습니다!** 🎉 이제 이 링크를 누구에게 보내도 열립니다.

## .nojekyll — 한 가지 함정 피하기

GitHub Pages는 기본적으로 **Jekyll**이라는 옛 블로그 엔진으로 파일을 한 번 처리하는데, 이게 가끔 우리 파일(특히 밑줄 `_`로 시작하는 것)을 무시해 버립니다. 이걸 끄려면 저장소 맨 위에 **`.nojekyll`**이라는 **빈 파일**을 하나 만들면 됩니다.

`Blog` 폴더에 `.nojekyll` 파일을 만들고(내용은 비워둠) 저장하세요. 이름 그대로, 점으로 시작하고 확장자는 없습니다. "Jekyll 처리 하지 마"라는 신호예요. 만들었으면 다시 add/commit/push.

## 5) 앞으로 배포하는 법 — deploy.bat 만들기

글을 새로 쓸 때마다 `build.js` 돌리고 add·commit·push를 손으로 치긴 번거롭죠. 윈도우라면 이 과정을 **한 번에** 해주는 파일을 만들 수 있습니다. `Blog` 폴더에 `deploy.bat`을 만들고 아래를 넣으세요. (이 블로그가 실제로 쓰는 파일과 같은 방식입니다.)

```bat
@echo off
chcp 65001 >nul
node build.js
git add .
git commit -m "글 업데이트"
git push
pause
```

- `@echo off` — 명령 자체는 화면에 안 찍고 결과만 보이게.
- `chcp 65001 >nul` — 한글이 안 깨지게 문자 인코딩을 UTF-8로.
- 그다음 세 줄이 바로 **빌드 → 담기 → 커밋 → 올리기**.
- `pause` — 끝나고 창이 바로 안 닫히게 "아무 키나 누르세요"에서 멈춤.

이제 글을 쓰거나 고친 뒤 **`deploy.bat`을 더블클릭**하면 자동으로 배포됩니다. 1~2분 뒤 사이트에 반영돼요.

> 맥/리눅스는 `.bat` 대신 `deploy.sh`에 `node build.js && git add . && git commit -m "글 업데이트" && git push`를 넣고 `sh deploy.sh`로 실행하면 됩니다.

## 자주 나는 실수

- **push가 거부됨(rejected)** → 원격에 내 로컬에 없는 변경이 있을 때. `git pull --no-edit` 후 다시 `git push`.
- **`git`이 인식 안 됨** → Git 미설치 또는 재부팅 필요(01편 참고).
- **Pages 주소로 들어갔는데 404** → 배포에 1~2분 걸립니다. 잠시 후 새로고침. Source가 `main / root`인지, `index.html`이 저장소 맨 위에 있는지 확인.
- **글은 올렸는데 목록에 안 뜸** → 배포 전에 `node build.js`(또는 deploy.bat)를 안 돌려 `posts.json`이 옛것. 다시 빌드 후 push.
- **커밋할 때 이름/이메일 오류** → 2)의 `git config` 설정을 안 한 경우.

## 정리

- **Git**은 변경 기록 도구, **GitHub**은 그걸 올리는 웹사이트, **Pages**는 무료 배포 기능.
- 흐름: **수정 → `git add .` → `git commit -m "..."` → `git push`**. (그 전에 `node build.js`)
- 저장소를 Public으로 만들고, Settings → Pages에서 `main / root`로 배포.
- **`.nojekyll`** 빈 파일로 Jekyll 처리를 끈다.
- **`deploy.bat`** 더블클릭으로 빌드+배포를 한 방에.

이제 우리 블로그는 인터넷에 있습니다. 다음 편(08)부터는 다시 코드로 돌아와, 여러 글을 **목록 카드**로 보여주고 클릭하면 글이 열리는 **진짜 블로그다운 화면**을 만들기 시작합니다.
