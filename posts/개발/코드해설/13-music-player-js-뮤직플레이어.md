---
title: "[코드 해설 13] music-player.js — 페이지 이동해도 음악이 안 끊기는 이유"
date: 2026-06-08
category: 개발/코드해설
tags: [JavaScript, Audio, SPA]
excerpt: 하단 고정 뮤직 플레이어의 동작 원리. HTMLAudioElement, 상태 저장/복원, 셔플 알고리즘을 설명합니다.
---

## 이 파일이 하는 일

화면 하단에 고정된 뮤직 플레이어를 담당합니다:
- `music/playlist.json`에서 곡 목록 로드
- 재생/일시정지/이전/다음/볼륨/셔플/반복
- 페이지 이동 시 재생 위치 저장 → 복원

---

## SPA에서 음악이 안 끊기는 이유

이 블로그는 페이지를 이동하지 않는 SPA입니다.  
`index.html` 하나에서 화면만 바꾸기 때문에 뮤직 플레이어(`<audio>`)가 계속 살아있어요.

반면 `editor.html`로 이동하면 진짜 페이지 이동이 일어납니다.  
이때는 `beforeunload` 이벤트로 재생 위치를 저장하고,  
`editor.html`에서도 같은 뮤직 플레이어가 시작되면서 이전 위치를 복원해요.

---

## 초기화 순서

```javascript
async init() {
  // 1. playlist.json 로드
  const res = await fetch('music/playlist.json');
  this.playlist = await res.json();

  // 2. HTML 구조 생성
  this._buildDOM();

  // 3. 버튼 이벤트 연결
  this._bindEvents();

  // 4. 이전 상태 복원 (localStorage)
  this._restoreState();

  // 5. UI 업데이트
  this._renderPlaylist();
  this._updateTrackInfo();
  this._updateControls();

  // 6. 페이지 떠날 때 상태 저장
  window.addEventListener('beforeunload', () => this._saveState());
},
```

---

## _buildDOM() — HTML을 JavaScript로 생성

```javascript
_buildDOM() {
  const div = document.createElement('div');
  div.id = 'musicPlayer';
  div.innerHTML = `
    <div class="player-bar">
      ...
    </div>
  `;
  document.body.appendChild(div);

  this.audio = new Audio();
  this.audio.preload = 'metadata';
},
```

`document.createElement('div')` → 새 div 요소 생성  
`document.body.appendChild(div)` → body 맨 아래에 추가

`new Audio()` → 보이지 않는 오디오 플레이어 생성  
브라우저가 기본 제공하는 `HTMLAudioElement`예요.

`preload = 'metadata'` → 재생 전에 길이, 비트레이트 등 메타데이터만 미리 로드합니다.  
음악 파일 전체를 미리 다운로드하지 않아요.

---

## _loadTrack() — 곡 로드

```javascript
_loadTrack(index, autoPlay = true) {
  this.currentIndex = ((index % this.playlist.length) + this.playlist.length) % this.playlist.length;
  const track = this.playlist[this.currentIndex];

  const rawSrc = track.file || track.src || '';
  this.audio.src = rawSrc;
  this.audio.load();

  if (autoPlay) {
    this.audio.play()
      .then(() => { this.isPlaying = true; })
      .catch(err => console.warn('[MusicPlayer] 재생 실패:', err));
  }
},
```

**인덱스 범위 보정:**
```javascript
((index % length) + length) % length
```

음수 인덱스가 들어와도 올바른 값을 반환합니다.  
`index = -1`, `length = 5` → `((-1 % 5) + 5) % 5 = 4` (마지막 곡)

`track.file || track.src || ''`  
→ `playlist.json`이 `file` 키를 쓰고, 예전 형식은 `src`를 쓸 수 있어요. 둘 다 지원합니다.

`this.audio.play()` → Promise를 반환합니다.  
`.catch(err => ...)` → 자동 재생 정책으로 실패할 수 있어서 오류를 잡아요.

---

## _prev() — 이전 곡 (3초 규칙)

```javascript
_prev() {
  if (this.audio.currentTime > 3) {
    this.audio.currentTime = 0; // 현재 곡 처음으로
    return;
  }
  const nextIdx = this._getPrevIndex();
  this._loadTrack(nextIdx, this.isPlaying);
},
```

음악 플레이어의 일반적인 UX:
- 3초 이내 → 이전 곡으로
- 3초 이후 → 현재 곡 처음으로

---

## _buildShuffleOrder() — 셔플 (Fisher-Yates)

```javascript
_buildShuffleOrder() {
  const arr = Array.from({ length: this.playlist.length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]; // 두 값 교환
  }
  this.shuffleOrder = arr;
},
```

`Array.from({ length: 5 }, (_, i) => i)` → `[0, 1, 2, 3, 4]`

**Fisher-Yates 셔플:**  
배열 끝에서 시작해서 앞으로 오면서, 무작위 위치와 현재 위치를 교환해요.  
완벽하게 균등한 확률로 섞입니다.

`[arr[i], arr[j]] = [arr[j], arr[i]]`  
→ 두 값을 동시에 교환하는 비구조화 할당(destructuring)입니다.  
임시 변수 없이 스왑할 수 있어요.

---

## _saveState() / _restoreState() — 상태 보존

```javascript
_saveState() {
  Storage.set('mp_index',  this.currentIndex);
  Storage.set('mp_time',   this.audio.currentTime);
  Storage.set('mp_volume', this.audio.volume);
},

_restoreState() {
  const savedIndex  = Storage.get('mp_index', 0);
  const savedVolume = Storage.get('mp_volume', 0.7);

  this.audio.volume = savedVolume;
  this._loadTrack(savedIndex, false); // autoPlay = false
},
```

페이지를 떠날 때(`beforeunload`) 저장하고,  
새 페이지에서 시작할 때 복원합니다.

`autoPlay = false` → 복원 시 자동 재생은 안 합니다.  
브라우저의 자동 재생 정책 때문에 사용자 행동 없이는 재생이 막힐 수 있어요.

---

## formatTime() — 시간 형식 변환

```javascript
function formatTime(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

`187.5초` → `"3:07"`

`Math.floor(187.5 / 60)` = 3 (분)  
`Math.floor(187.5 % 60)` = 7 (초의 나머지)  
`(7).toString().padStart(2, '0')` = `"07"` (한 자리면 앞에 0 붙임)
