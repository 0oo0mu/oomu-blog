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

## 전체 코드

먼저 전체 코드를 눈으로 훑어보세요. 아래에서 한 부분씩 잘라 설명합니다.

```javascript
import Storage from '../core/storage.js';

const SK = {
  INDEX:    'mp_index',
  TIME:     'mp_time',
  VOLUME:   'mp_volume',
  SHUFFLE:  'mp_shuffle',
  REPEAT:   'mp_repeat',
};

const MusicPlayer = {
  audio:        null,
  playlist:     [],
  currentIndex: 0,
  isPlaying:    false,
  isShuffled:   false,
  repeatMode:   'none',
  shuffleOrder: [],
  el: {},

  async init() {
    try {
      const res = await fetch('music/playlist.json');
      if (!res.ok) throw new Error('playlist.json not found');
      this.playlist = await res.json();
    } catch {
      this.playlist = [];
    }

    this._buildDOM();
    this._bindEvents();
    this._restoreState();
    this._renderPlaylist();
    this._updateTrackInfo();
    this._updateControls();

    window.addEventListener('beforeunload', () => this._saveState());
  },

  _buildDOM() {
    const div = document.createElement('div');
    div.id = 'musicPlayer';
    div.className = 'music-player';
    div.innerHTML = `
      <div class="playlist-panel" id="playlistPanel">
        <div class="playlist-header">
          <span>재생목록 <span id="playlistCount"></span></span>
          <button id="playlistCloseBtn" title="닫기">✕</button>
        </div>
        <ul class="playlist-items" id="playlistItems"></ul>
      </div>
      <div class="player-bar">
        <div class="player-track">
          <div class="track-cover" id="trackCover">♫</div>
          <div class="track-info">
            <div class="track-title"  id="trackTitle">재생목록을 추가하세요</div>
            <div class="track-artist" id="trackArtist">music/playlist.json</div>
          </div>
        </div>
        <div class="player-center">
          <div class="player-controls">
            <button class="ctrl-btn" id="mpPrevBtn"  title="이전 곡">⏮</button>
            <button class="ctrl-btn play-btn" id="mpPlayBtn" title="재생/일시정지">▶</button>
            <button class="ctrl-btn" id="mpNextBtn"  title="다음 곡">⏭</button>
          </div>
          <div class="player-progress">
            <span class="time" id="mpCurrentTime">0:00</span>
            <input type="range" class="progress-slider" id="mpProgress" min="0" value="0" step="0.1" />
            <span class="time" id="mpDuration">0:00</span>
          </div>
        </div>
        <div class="player-extra">
          <button class="ctrl-btn" id="mpShuffleBtn" title="셔플">🔀</button>
          <button class="ctrl-btn" id="mpRepeatBtn"  title="반복">🔁</button>
          <div class="volume-wrap">
            <button class="ctrl-btn" id="mpMuteBtn" title="음소거">🔊</button>
            <input type="range" class="volume-slider" id="mpVolume" min="0" max="100" value="70" />
          </div>
          <button class="ctrl-btn" id="mpListBtn" title="재생목록">☰</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    document.body.classList.add('has-player');

    this.el = {
      panel:       document.getElementById('playlistPanel'),
      items:       document.getElementById('playlistItems'),
      count:       document.getElementById('playlistCount'),
      cover:       document.getElementById('trackCover'),
      title:       document.getElementById('trackTitle'),
      artist:      document.getElementById('trackArtist'),
      playBtn:     document.getElementById('mpPlayBtn'),
      prevBtn:     document.getElementById('mpPrevBtn'),
      nextBtn:     document.getElementById('mpNextBtn'),
      progress:    document.getElementById('mpProgress'),
      currentTime: document.getElementById('mpCurrentTime'),
      duration:    document.getElementById('mpDuration'),
      shuffleBtn:  document.getElementById('mpShuffleBtn'),
      repeatBtn:   document.getElementById('mpRepeatBtn'),
      muteBtn:     document.getElementById('mpMuteBtn'),
      volume:      document.getElementById('mpVolume'),
      listBtn:     document.getElementById('mpListBtn'),
      closeBtn:    document.getElementById('playlistCloseBtn'),
    };

    this.audio = new Audio();
    this.audio.preload = 'metadata';
  },

  _bindEvents() {
    const { el, audio } = this;

    el.playBtn.addEventListener('click', () => this._togglePlay());
    el.prevBtn.addEventListener('click', () => this._prev());
    el.nextBtn.addEventListener('click', () => this._next());

    let seeking = false;
    el.progress.addEventListener('mousedown',  () => { seeking = true; });
    el.progress.addEventListener('touchstart', () => { seeking = true; });
    el.progress.addEventListener('change', () => {
      audio.currentTime = parseFloat(el.progress.value);
      seeking = false;
    });
    el.progress.addEventListener('input', () => {
      this._updateSliderFill(el.progress);
      el.currentTime.textContent = formatTime(parseFloat(el.progress.value));
    });

    audio.addEventListener('timeupdate', () => {
      if (!seeking && !isNaN(audio.duration)) {
        const pct = (audio.currentTime / audio.duration) * 100;
        el.progress.value = audio.currentTime;
        el.currentTime.textContent = formatTime(audio.currentTime);
        this._updateSliderFill(el.progress, pct);
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      el.progress.max = audio.duration;
      el.duration.textContent = formatTime(audio.duration);
      const savedTime = Storage.get(SK.TIME, 0);
      if (savedTime > 0) {
        audio.currentTime = savedTime;
        Storage.remove(SK.TIME);
      }
    });

    audio.addEventListener('ended', () => this._onEnded());

    el.volume.addEventListener('input', () => {
      const vol = parseInt(el.volume.value) / 100;
      audio.volume = vol;
      Storage.set(SK.VOLUME, vol);
      this._updateSliderFill(el.volume);
      el.muteBtn.textContent = vol === 0 ? '🔇' : '🔊';
    });

    el.muteBtn.addEventListener('click', () => {
      if (audio.volume > 0) {
        this._prevVolume = audio.volume;
        audio.volume = 0;
        el.volume.value = 0;
        el.muteBtn.textContent = '🔇';
      } else {
        const restore = this._prevVolume || 0.7;
        audio.volume = restore;
        el.volume.value = restore * 100;
        el.muteBtn.textContent = '🔊';
      }
      this._updateSliderFill(el.volume);
    });

    el.shuffleBtn.addEventListener('click', () => {
      this.isShuffled = !this.isShuffled;
      if (this.isShuffled) this._buildShuffleOrder();
      el.shuffleBtn.classList.toggle('on', this.isShuffled);
      Storage.set(SK.SHUFFLE, this.isShuffled);
    });

    el.repeatBtn.addEventListener('click', () => {
      const modes = ['none', 'one', 'all'];
      const next  = modes[(modes.indexOf(this.repeatMode) + 1) % modes.length];
      this.repeatMode = next;
      Storage.set(SK.REPEAT, next);
      this._updateRepeatBtn();
    });

    el.listBtn.addEventListener('click', () => {
      el.panel.classList.toggle('open');
    });
    el.closeBtn.addEventListener('click', () => {
      el.panel.classList.remove('open');
    });
  },

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

  _loadTrack(index, autoPlay = true) {
    if (this.playlist.length === 0) return;
    this.currentIndex = ((index % this.playlist.length) + this.playlist.length) % this.playlist.length;
    const track = this.playlist[this.currentIndex];
    const rawSrc = track.file || track.src || '';
    this.audio.src = rawSrc;
    this.audio.load();
    Storage.set(SK.INDEX, this.currentIndex);
    this._updateTrackInfo();
    this._updatePlaylistHighlight();
    this._resetProgress();
    if (autoPlay) {
      this.audio.play()
        .then(() => { this.isPlaying = true; this._updatePlayBtn(); })
        .catch(err => console.warn('[MusicPlayer] 재생 실패:', err));
    }
  },

  _prev() {
    if (this.playlist.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    this._loadTrack(this._getPrevIndex(), this.isPlaying);
  },

  _next() {
    if (this.playlist.length === 0) return;
    this._loadTrack(this._getNextIndex(), this.isPlaying);
  },

  _onEnded() {
    switch (this.repeatMode) {
      case 'one':
        this.audio.currentTime = 0;
        this.audio.play();
        break;
      case 'all':
        this._loadTrack(this._getNextIndex(), true);
        break;
      default:
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

  _buildShuffleOrder() {
    const arr = Array.from({ length: this.playlist.length }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const curPos = arr.indexOf(this.currentIndex);
    if (curPos !== 0) [arr[0], arr[curPos]] = [arr[curPos], arr[0]];
    this.shuffleOrder = arr;
  },

  _getNextIndex() {
    if (this.isShuffled) {
      const pos = this.shuffleOrder.indexOf(this.currentIndex);
      return this.shuffleOrder[(pos + 1) % this.shuffleOrder.length];
    }
    return (this.currentIndex + 1) % this.playlist.length;
  },

  _getPrevIndex() {
    if (this.isShuffled) {
      const pos = this.shuffleOrder.indexOf(this.currentIndex);
      return this.shuffleOrder[(pos - 1 + this.shuffleOrder.length) % this.shuffleOrder.length];
    }
    return (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
  },

  _updateTrackInfo() {
    const track = this.playlist[this.currentIndex];
    if (!track) return;
    this.el.title.textContent  = track.title  || '제목 없음';
    this.el.artist.textContent = track.artist || '';
    if (track.cover) {
      this.el.cover.innerHTML = `<img src="${track.cover}" alt="${track.title}" />`;
    } else {
      this.el.cover.textContent = '♫';
    }
  },

  _updatePlayBtn() {
    this.el.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
  },

  _updateRepeatBtn() {
    const { repeatBtn } = this.el;
    const icons = { none: '🔁', one: '🔂', all: '🔁' };
    repeatBtn.textContent = icons[this.repeatMode];
    repeatBtn.classList.toggle('on', this.repeatMode !== 'none');
    repeatBtn.title = { none: '반복 없음', one: '한 곡 반복', all: '전체 반복' }[this.repeatMode];
  },

  _updateControls() {
    this._updatePlayBtn();
    this._updateRepeatBtn();
    this.el.shuffleBtn.classList.toggle('on', this.isShuffled);
    const vol = this.audio.volume;
    this.el.volume.value = vol * 100;
    this._updateSliderFill(this.el.volume);
    this.el.muteBtn.textContent = vol === 0 ? '🔇' : '🔊';
  },

  _renderPlaylist() {
    const { items, count } = this.el;
    count.textContent = `(${this.playlist.length})`;

    if (this.playlist.length === 0) {
      items.innerHTML = `<li class="playlist-empty">music/playlist.json에 곡을 추가하세요.</li>`;
      return;
    }

    items.innerHTML = this.playlist.map((track, idx) => `
      <li class="playlist-item ${idx === this.currentIndex ? 'active' : ''}"
          data-index="${idx}">
        <span class="playlist-num">${idx + 1}</span>
        <div class="playlist-track-info">
          <div class="playlist-track-title">${track.title || '제목 없음'}</div>
          <div class="playlist-track-artist">${track.artist || ''}</div>
        </div>
      </li>
    `).join('');

    items.addEventListener('click', (e) => {
      const li = e.target.closest('.playlist-item');
      if (!li) return;
      const idx = parseInt(li.dataset.index);
      this._loadTrack(idx, true);
      this.isPlaying = true;
      this._updatePlayBtn();
    });
  },

  _updatePlaylistHighlight() {
    this.el.items.querySelectorAll('.playlist-item').forEach((li, idx) => {
      li.classList.toggle('active', idx === this.currentIndex);
    });
  },

  _resetProgress() {
    this.el.progress.value = 0;
    this.el.currentTime.textContent = '0:00';
    this.el.duration.textContent = '0:00';
    this._updateSliderFill(this.el.progress, 0);
  },

  _updateSliderFill(slider, pct) {
    const value = pct ?? ((parseFloat(slider.value) / parseFloat(slider.max || 100)) * 100);
    slider.style.setProperty('--pct', `${Math.max(0, Math.min(100, value))}%`);
  },

  _saveState() {
    Storage.set(SK.INDEX,   this.currentIndex);
    Storage.set(SK.TIME,    this.audio.currentTime);
    Storage.set(SK.VOLUME,  this.audio.volume);
    Storage.set(SK.SHUFFLE, this.isShuffled);
    Storage.set(SK.REPEAT,  this.repeatMode);
  },

  _restoreState() {
    const savedIndex  = Storage.get(SK.INDEX,   0);
    const savedVolume = Storage.get(SK.VOLUME,  0.7);
    const savedShuffle= Storage.get(SK.SHUFFLE, false);
    const savedRepeat = Storage.get(SK.REPEAT,  'none');

    this.repeatMode = savedRepeat;
    this.isShuffled = savedShuffle;
    this.audio.volume = savedVolume;

    if (this.playlist.length > 0) {
      const idx = Math.min(savedIndex, this.playlist.length - 1);
      this._loadTrack(idx, false);
    }

    if (this.isShuffled) this._buildShuffleOrder();
  },
};

function formatTime(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default MusicPlayer;
```

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
