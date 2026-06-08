---
title: "[코드 해설 13] music-player.js — 페이지 이동해도 끊기지 않는 뮤직 플레이어"
date: 2026-06-02
category: 개발/코드해설
tags: [JavaScript, Audio, 뮤직플레이어]
excerpt: 셔플, 반복, 볼륨, 재생 위치 복원까지 갖춘 뮤직 플레이어. HTMLAudioElement, Fisher-Yates 셔플, 상태 저장/복원을 한 줄씩 설명합니다.
---

# music-player.js — 페이지 이동해도 끊기지 않는 뮤직 플레이어

## 이 파일이 하는 일

하단에 고정된 뮤직 플레이어를 만들고 관리합니다.
SPA 방식이라 페이지를 이동해도 이 플레이어는 파괴되지 않아 음악이 계속 재생됩니다.

**기능 목록:**
- playlist.json에서 곡 목록 로드
- 재생/일시정지, 이전/다음 곡
- 프로그레스 바 (드래그 가능)
- 볼륨 조절, 음소거
- 셔플 (Fisher-Yates 알고리즘)
- 반복 모드 (없음 / 한 곡 / 전체)
- 플레이리스트 패널
- 페이지 이동 후 재생 위치 복원

---

## playlist.json 구조

```json
[
  {
    "title": "Chill Beats",
    "artist": "Lo-Fi Artist",
    "src": "chill.mp3",
    "cover": "covers/chill.jpg"
  },
  {
    "title": "외부 스트리밍",
    "src": "https://example.com/stream.mp3"
  }
]
```

`src`가 `http`로 시작하면 외부 URL, 아니면 `music/` 폴더 안의 파일로 처리합니다.

---

## 상태 저장 키

```js
const SK = {
  INDEX:    'mp_index',    // 현재 곡 인덱스 (0, 1, 2, ...)
  TIME:     'mp_time',     // 재생 위치 (초 단위, 예: 73.5)
  VOLUME:   'mp_volume',   // 볼륨 (0~1)
  SHUFFLE:  'mp_shuffle',  // 셔플 여부 (true/false)
  REPEAT:   'mp_repeat',   // 반복 모드 ('none', 'one', 'all')
};
```

이 5가지 상태를 localStorage에 저장합니다. 페이지를 이동해도 이어서 재생됩니다.

---

## 핵심 코드 설명

### `_buildDOM` — 플레이어 HTML 삽입

```js
_buildDOM() {
  const div = document.createElement('div');
  div.id = 'musicPlayer';
  div.innerHTML = `
    <div class="playlist-panel" id="playlistPanel"> ... </div>
    <div class="player-bar"> ... </div>
  `;
  document.body.appendChild(div);
  document.body.classList.add('has-player');
```

**`document.createElement('div')`**
JavaScript로 div 요소를 만듭니다. 아직 화면에 보이지 않습니다.

**`document.body.appendChild(div)`**
body 맨 아래에 추가합니다. 이제 화면에 나타납니다.

**`document.body.classList.add('has-player')`**
body에 클래스를 추가해서 본문 하단에 플레이어 높이만큼 여백을 줍니다. 플레이어에 가려지지 않도록.

---

### `_togglePlay` — 재생/일시정지

```js
_togglePlay() {
  if (this.playlist.length === 0) return;

  if (this.isPlaying) {
    this.audio.pause();
    this.isPlaying = false;
  } else {
    if (!this.audio.src || this.audio.src === window.location.href) {
      this._loadTrack(this.currentIndex, false);
    }
    this.audio.play().catch(err => console.warn('[MusicPlayer] 재생 실패:', err));
    this.isPlaying = true;
  }
  this._updatePlayBtn();
},
```

**`this.audio.play().catch(...)`**
`audio.play()`는 Promise를 반환합니다. 브라우저 정책으로 자동재생이 막히면 실패합니다.
`.catch`로 오류를 잡아서 경고만 출력하고 진행합니다.

**`this.audio.src === window.location.href`**
Audio 엘리먼트를 처음 만들면 src가 현재 페이지 URL이 됩니다.
이 경우 곡을 먼저 로드해야 합니다.

---

### `_loadTrack` — 특정 곡 로드

```js
_loadTrack(index, autoPlay = true) {
  this.currentIndex = ((index % this.playlist.length) + this.playlist.length) % this.playlist.length;
```

**`((index % 길이) + 길이) % 길이`**
index가 음수거나 범위를 벗어날 때도 항상 올바른 인덱스를 만드는 공식입니다.

예: 길이=5, index=-1 → `((-1 % 5) + 5) % 5 = (-1 + 5) % 5 = 4 % 5 = 4` ✅
예: 길이=5, index=6  → `(6 % 5 + 5) % 5 = (1 + 5) % 5 = 6 % 5 = 1` ✅

```js
  const src = track.src.startsWith('http') ? track.src : `music/${track.src}`;
  this.audio.src = src;
  this.audio.load();
```

외부 URL이면 그대로, 로컬 파일이면 `music/` 접두사를 붙입니다.
`this.audio.load()`는 브라우저에 "새 소스로 다시 로드해"라고 알립니다.

---

### `_prev` — 이전 곡

```js
_prev() {
  if (this.playlist.length === 0) return;
  if (this.audio.currentTime > 3) {
    this.audio.currentTime = 0;
    return;
  }
  const nextIdx = this._getPrevIndex();
  this._loadTrack(nextIdx, this.isPlaying);
},
```

재생 시작 후 **3초 이내**면 이전 곡으로 이동, **3초 이후**면 현재 곡을 처음부터 재생합니다.
대부분의 음악 플레이어(Spotify, 유튜브 뮤직 등)의 동작 방식입니다.

---

### `_buildShuffleOrder` — Fisher-Yates 셔플

```js
_buildShuffleOrder() {
  const arr = Array.from({ length: this.playlist.length }, (_, i) => i);
  // arr = [0, 1, 2, 3, 4] (예시, 5곡인 경우)

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];  // 두 값 교환
  }

  // 현재 곡을 맨 앞으로
  const curPos = arr.indexOf(this.currentIndex);
  if (curPos !== 0) {
    [arr[0], arr[curPos]] = [arr[curPos], arr[0]];
  }

  this.shuffleOrder = arr;
},
```

**`Array.from({ length: 5 }, (_, i) => i)`**
`[0, 1, 2, 3, 4]` 배열을 만듭니다. `_`는 사용하지 않는 인자(관례상 언더스코어).

**Fisher-Yates 셔플 알고리즘:**
맨 끝부터 역순으로, 남은 항목 중 무작위로 골라서 교환합니다.
모든 순열이 동등하게 나올 확률을 보장하는 수학적으로 올바른 셔플 방법입니다.

```
[0, 1, 2, 3, 4]
i=4: j=무작위(0~4), 예: j=2 → [0, 1, 4, 3, 2]
i=3: j=무작위(0~3), 예: j=0 → [3, 1, 4, 0, 2]
i=2: j=무작위(0~2), 예: j=2 → [3, 1, 4, 0, 2]
i=1: j=무작위(0~1), 예: j=1 → [3, 1, 4, 0, 2]
결과: [3, 1, 4, 0, 2]
```

**`[arr[i], arr[j]] = [arr[j], arr[i]]`**
두 값을 동시에 교환합니다. 임시 변수 없이 가능한 구조분해 할당입니다.

---

### `_onEnded` — 곡이 끝났을 때

```js
_onEnded() {
  switch (this.repeatMode) {
    case 'one':
      this.audio.currentTime = 0;
      this.audio.play();
      break;
    case 'all':
      this._loadTrack(this._getNextIndex(), true);
      break;
    default:  // 'none'
      const nextIdx = this._getNextIndex();
      if (nextIdx === 0 && !this.isShuffled) {
        this.isPlaying = false;
        this._updatePlayBtn();
        this._resetProgress();
      } else {
        this._loadTrack(nextIdx, true);
      }
  }
},
```

**`switch`문**
`if/else if/else`를 여러 경우에 쓸 때의 깔끔한 대안입니다.
`case 'one':` → repeatMode가 'one'일 때 실행. `break`로 switch 탈출.

**반복 없음 로직:**
`nextIdx === 0 && !this.isShuffled` = 마지막 곡이 끝나고, 셔플도 아닌 경우.
셔플이면 0번 인덱스가 꼭 마지막이라는 보장이 없어서 조건에서 제외합니다.

---

### `_saveState` & `_restoreState` — 상태 저장/복원

```js
_saveState() {
  Storage.set(SK.INDEX,   this.currentIndex);
  Storage.set(SK.TIME,    this.audio.currentTime);
  Storage.set(SK.VOLUME,  this.audio.volume);
  Storage.set(SK.SHUFFLE, this.isShuffled);
  Storage.set(SK.REPEAT,  this.repeatMode);
},
```

`window.addEventListener('beforeunload', () => this._saveState())`로
페이지를 떠나기 직전에 자동 호출됩니다.

```js
_restoreState() {
  // ...상태 읽기...
  this._loadTrack(idx, false);  // autoPlay = false → 정지 상태 유지
},
```

초기 상태: **자동 재생 안 함**. 사용자가 직접 재생 버튼을 눌러야 합니다.
브라우저 정책으로 자동 재생이 막혀있어서, 강제로 재생하면 오류가 납니다.

재생 위치(시간) 복원은 `loadedmetadata` 이벤트에서 합니다.
오디오가 로드되기 전에 `currentTime`을 설정하면 적용이 안 됩니다.

```js
audio.addEventListener('loadedmetadata', () => {
  el.progress.max = audio.duration;   // 재생 바 최대값 설정
  const savedTime = Storage.get(SK.TIME, 0);
  if (savedTime > 0) {
    audio.currentTime = savedTime;    // 저장된 위치로 이동
    Storage.remove(SK.TIME);          // 한 번 복원하면 삭제
  }
});
```

---

### `_updateSliderFill` — 슬라이더 색 채우기

```js
_updateSliderFill(slider, pct) {
  const value = pct ?? ((parseFloat(slider.value) / parseFloat(slider.max || 100)) * 100);
  slider.style.setProperty('--pct', `${Math.max(0, Math.min(100, value))}%`);
},
```

**`pct ?? ...`**
`??`는 null 병합 연산자입니다. `pct`가 null 또는 undefined이면 오른쪽을 씁니다.
(0은 falsy지만 `??`는 통과시킵니다. `||` 는 0도 막는데 이게 차이점입니다)

**`Math.max(0, Math.min(100, value))`**
값을 0~100 범위로 제한합니다. `Math.min(100, value)`는 최대 100, `Math.max(0, ...)`는 최소 0.

CSS에서 `--pct` 변수를 슬라이더 배경 그라데이션에 사용합니다.
```css
input[type="range"] {
  background: linear-gradient(to right, var(--accent) var(--pct), #ddd var(--pct));
}
```

---

## 다음 파일

- **[14] markdown.js** — 마크다운 파일을 HTML로 변환하기
