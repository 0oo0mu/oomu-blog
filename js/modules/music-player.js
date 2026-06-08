/**
 * js/modules/music-player.js — 하단 고정 뮤직 플레이어
 *
 * 기능:
 *   - music/playlist.json에서 플레이리스트 로드
 *   - 로컬 파일(music/*.mp3)과 외부 URL 모두 지원
 *   - 재생/일시정지/이전/다음/볼륨/셔플/반복
 *   - 플레이리스트 패널 슬라이드
 *   - 페이지 이동 시 현재 곡 + 재생 위치 저장 → 다음 페이지에서 복원
 *   - 초기 상태: 자동 정지 (사용자가 직접 재생 버튼 눌러야 함)
 *
 * App 이벤트:
 *   발행: 없음 (독립 모듈)
 *   구독: 없음 (독립 모듈)
 */

import Storage from '../core/storage.js';

// localStorage 키
const SK = {
  INDEX:    'mp_index',   // 현재 곡 인덱스
  TIME:     'mp_time',    // 재생 위치 (초)
  VOLUME:   'mp_volume',  // 볼륨 (0~1)
  SHUFFLE:  'mp_shuffle', // 셔플 켜짐 여부
  REPEAT:   'mp_repeat',  // 반복 모드 ('none'|'one'|'all')
};

const MusicPlayer = {
  // ── 상태 ──
  audio:        null,    // HTMLAudioElement
  playlist:     [],      // 전체 곡 목록 (playlist.json)
  currentIndex: 0,       // 현재 곡 인덱스
  isPlaying:    false,
  isShuffled:   false,
  repeatMode:   'none',  // 'none' | 'one' | 'all'
  shuffleOrder: [],      // 셔플 시 재생 순서 배열

  // ── DOM 요소 참조 ──
  el: {},

  /**
   * 초기화: playlist.json 로드 → DOM 생성 → 상태 복원 → 이벤트 연결
   * App.register('music', MusicPlayer) 시 자동 호출됩니다.
   */
  async init() {
    try {
      const res = await fetch('music/playlist.json');
      if (!res.ok) throw new Error('playlist.json not found');
      this.playlist = await res.json();
    } catch {
      // playlist.json이 없거나 비어있으면 플레이어를 렌더링하되 "목록 없음" 표시
      this.playlist = [];
    }

    this._buildDOM();    // HTML 구조 생성
    this._bindEvents();  // 버튼/슬라이더 이벤트 연결
    this._restoreState();// localStorage에서 이전 상태 복원
    this._renderPlaylist();
    this._updateTrackInfo();
    this._updateControls();

    // 페이지 떠나기 전에 현재 상태 저장
    window.addEventListener('beforeunload', () => this._saveState());
  },

  // ══════════════════════════════════════════════════════
  // [1] DOM 생성
  // ══════════════════════════════════════════════════════

  /**
   * 플레이어 HTML을 body에 직접 삽입합니다.
   * 어떤 페이지에서든 동일하게 동작합니다.
   */
  _buildDOM() {
    const div = document.createElement('div');
    div.id = 'musicPlayer';
    div.className = 'music-player';
    div.innerHTML = `
      <!-- 플레이리스트 패널 (위로 슬라이드) -->
      <div class="playlist-panel" id="playlistPanel">
        <div class="playlist-header">
          <span>재생목록 <span id="playlistCount"></span></span>
          <button id="playlistCloseBtn" title="닫기">✕</button>
        </div>
        <ul class="playlist-items" id="playlistItems"></ul>
      </div>

      <!-- 플레이어 바 -->
      <div class="player-bar">

        <!-- 왼쪽: 트랙 정보 -->
        <div class="player-track">
          <div class="track-cover" id="trackCover">♫</div>
          <div class="track-info">
            <div class="track-title"  id="trackTitle">재생목록을 추가하세요</div>
            <div class="track-artist" id="trackArtist">music/playlist.json</div>
          </div>
        </div>

        <!-- 가운데: 재생 버튼 + 프로그레스 -->
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

        <!-- 오른쪽: 셔플/반복/볼륨/목록 -->
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
    document.body.classList.add('has-player'); // 본문 하단 여백 추가

    // DOM 요소 참조 저장 (매번 querySelector 하지 않도록)
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

    // Audio 엘리먼트 생성 (보이지 않는 오디오 플레이어)
    this.audio = new Audio();
    this.audio.preload = 'metadata'; // 재생 전에 메타데이터(길이 등)만 미리 로드
  },

  // ══════════════════════════════════════════════════════
  // [2] 이벤트 연결
  // ══════════════════════════════════════════════════════

  _bindEvents() {
    const { el, audio } = this;

    // ── 재생 컨트롤 ──
    el.playBtn.addEventListener('click', () => this._togglePlay());
    el.prevBtn.addEventListener('click', () => this._prev());
    el.nextBtn.addEventListener('click', () => this._next());

    // ── 프로그레스 슬라이더 ──
    // 드래그 중에는 오디오 업데이트를 멈추고, 드래그 끝나면 이동
    let seeking = false;
    el.progress.addEventListener('mousedown',  () => { seeking = true; });
    el.progress.addEventListener('touchstart', () => { seeking = true; });
    el.progress.addEventListener('change', () => {
      audio.currentTime = parseFloat(el.progress.value);
      seeking = false;
    });
    el.progress.addEventListener('input', () => {
      // 슬라이더 색상 채우기
      this._updateSliderFill(el.progress);
      el.currentTime.textContent = formatTime(parseFloat(el.progress.value));
    });

    // ── 오디오 시간 업데이트 ──
    audio.addEventListener('timeupdate', () => {
      if (!seeking && !isNaN(audio.duration)) {
        const pct = (audio.currentTime / audio.duration) * 100;
        el.progress.value = audio.currentTime;
        el.currentTime.textContent = formatTime(audio.currentTime);
        this._updateSliderFill(el.progress, pct);
      }
    });

    // ── 오디오 메타데이터 로드 (duration 파악) ──
    audio.addEventListener('loadedmetadata', () => {
      el.progress.max = audio.duration;
      el.duration.textContent = formatTime(audio.duration);
      // 복원된 시간이 있으면 적용
      const savedTime = Storage.get(SK.TIME, 0);
      if (savedTime > 0) {
        audio.currentTime = savedTime;
        Storage.remove(SK.TIME); // 한 번 복원하면 삭제
      }
    });

    // ── 곡 끝나면 다음 곡 ──
    audio.addEventListener('ended', () => this._onEnded());

    // ── 볼륨 슬라이더 ──
    el.volume.addEventListener('input', () => {
      const vol = parseInt(el.volume.value) / 100;
      audio.volume = vol;
      Storage.set(SK.VOLUME, vol);
      this._updateSliderFill(el.volume);
      el.muteBtn.textContent = vol === 0 ? '🔇' : '🔊';
    });

    // ── 음소거 버튼 ──
    el.muteBtn.addEventListener('click', () => {
      if (audio.volume > 0) {
        this._prevVolume = audio.volume; // 이전 볼륨 저장
        audio.volume = 0;
        el.volume.value = 0;
        el.muteBtn.textContent = '🔇';
      } else {
        // 음소거 해제: 이전 볼륨으로 복원
        const restore = this._prevVolume || 0.7;
        audio.volume = restore;
        el.volume.value = restore * 100;
        el.muteBtn.textContent = '🔊';
      }
      this._updateSliderFill(el.volume);
    });

    // ── 셔플 버튼 ──
    el.shuffleBtn.addEventListener('click', () => {
      this.isShuffled = !this.isShuffled;
      if (this.isShuffled) this._buildShuffleOrder();
      el.shuffleBtn.classList.toggle('on', this.isShuffled);
      Storage.set(SK.SHUFFLE, this.isShuffled);
    });

    // ── 반복 버튼 ──
    // none → one → all → none 순으로 순환
    el.repeatBtn.addEventListener('click', () => {
      const modes = ['none', 'one', 'all'];
      const next  = modes[(modes.indexOf(this.repeatMode) + 1) % modes.length];
      this.repeatMode = next;
      Storage.set(SK.REPEAT, next);
      this._updateRepeatBtn();
    });

    // ── 플레이리스트 버튼 ──
    el.listBtn.addEventListener('click', () => {
      el.panel.classList.toggle('open');
    });
    el.closeBtn.addEventListener('click', () => {
      el.panel.classList.remove('open');
    });
  },

  // ══════════════════════════════════════════════════════
  // [3] 재생 제어
  // ══════════════════════════════════════════════════════

  /**
   * 재생/일시정지 토글
   */
  _togglePlay() {
    if (this.playlist.length === 0) return;
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      // audio.src가 비어있으면 현재 곡 먼저 로드
      if (!this.audio.src || this.audio.src === window.location.href) {
        this._loadTrack(this.currentIndex, false);
      }
      this.audio.play().catch(err => console.warn('[MusicPlayer] 재생 실패:', err));
      this.isPlaying = true;
    }
    this._updatePlayBtn();
  },

  /**
   * 특정 인덱스의 곡을 로드합니다.
   *
   * @param {number}  index    - 플레이리스트 인덱스
   * @param {boolean} autoPlay - true면 로드 후 즉시 재생
   */
  _loadTrack(index, autoPlay = true) {
    if (this.playlist.length === 0) return;

    // 인덱스 범위 보정
    this.currentIndex = ((index % this.playlist.length) + this.playlist.length) % this.playlist.length;
    const track = this.playlist[this.currentIndex];

    // src 경로 처리: 외부 URL이면 그대로, 로컬 파일이면 'music/' 접두사 추가
    const src = track.src.startsWith('http') ? track.src : `music/${track.src}`;
    this.audio.src = src;
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

  /**
   * 이전 곡으로 이동
   * - 재생 시작 후 3초 이내면 이전 곡으로 이동
   * - 3초 이후면 현재 곡을 처음부터 재생
   */
  _prev() {
    if (this.playlist.length === 0) return;
    if (this.audio.currentTime > 3) {
      // 현재 곡 처음으로
      this.audio.currentTime = 0;
      return;
    }
    const nextIdx = this._getPrevIndex();
    this._loadTrack(nextIdx, this.isPlaying);
  },

  /**
   * 다음 곡으로 이동
   */
  _next() {
    if (this.playlist.length === 0) return;
    const nextIdx = this._getNextIndex();
    this._loadTrack(nextIdx, this.isPlaying);
  },

  /**
   * 곡이 끝났을 때 처리
   */
  _onEnded() {
    switch (this.repeatMode) {
      case 'one':
        // 한 곡 반복: 현재 곡 처음부터
        this.audio.currentTime = 0;
        this.audio.play();
        break;
      case 'all':
        // 전체 반복: 다음 곡 (마지막이면 첫 번째로)
        this._loadTrack(this._getNextIndex(), true);
        break;
      default:
        // 반복 없음: 마지막 곡이면 정지, 아니면 다음 곡
        const nextIdx = this._getNextIndex();
        if (nextIdx === 0 && !this.isShuffled) {
          // 마지막 곡 끝 → 정지
          this.isPlaying = false;
          this._updatePlayBtn();
          this._resetProgress();
        } else {
          this._loadTrack(nextIdx, true);
        }
    }
  },

  // ══════════════════════════════════════════════════════
  // [4] 셔플 & 반복
  // ══════════════════════════════════════════════════════

  /**
   * 셔플 순서 배열을 생성합니다.
   * Fisher-Yates 알고리즘으로 무작위 순서 생성.
   */
  _buildShuffleOrder() {
    const arr = Array.from({ length: this.playlist.length }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]; // 두 값 교환
    }
    // 현재 곡을 맨 앞으로 이동
    const curPos = arr.indexOf(this.currentIndex);
    if (curPos !== 0) {
      [arr[0], arr[curPos]] = [arr[curPos], arr[0]];
    }
    this.shuffleOrder = arr;
  },

  /**
   * 다음 곡 인덱스를 반환합니다. (셔플 고려)
   * @returns {number}
   */
  _getNextIndex() {
    if (this.isShuffled) {
      const pos = this.shuffleOrder.indexOf(this.currentIndex);
      return this.shuffleOrder[(pos + 1) % this.shuffleOrder.length];
    }
    return (this.currentIndex + 1) % this.playlist.length;
  },

  /**
   * 이전 곡 인덱스를 반환합니다. (셔플 고려)
   * @returns {number}
   */
  _getPrevIndex() {
    if (this.isShuffled) {
      const pos = this.shuffleOrder.indexOf(this.currentIndex);
      return this.shuffleOrder[(pos - 1 + this.shuffleOrder.length) % this.shuffleOrder.length];
    }
    return (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
  },

  // ══════════════════════════════════════════════════════
  // [5] UI 업데이트
  // ══════════════════════════════════════════════════════

  /**
   * 현재 곡의 제목/아티스트/커버를 표시합니다.
   */
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

  /**
   * 재생/일시정지 버튼 아이콘을 업데이트합니다.
   */
  _updatePlayBtn() {
    this.el.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
  },

  /**
   * 반복 버튼 아이콘/상태를 업데이트합니다.
   * none: 흐림, one: 🔂 + 활성, all: 🔁 + 활성
   */
  _updateRepeatBtn() {
    const { repeatBtn } = this.el;
    const icons = { none: '🔁', one: '🔂', all: '🔁' };
    repeatBtn.textContent = icons[this.repeatMode];
    repeatBtn.classList.toggle('on', this.repeatMode !== 'none');
    repeatBtn.title = { none: '반복 없음', one: '한 곡 반복', all: '전체 반복' }[this.repeatMode];
  },

  /**
   * 컨트롤 초기 상태를 업데이트합니다. (상태 복원 후 호출)
   */
  _updateControls() {
    this._updatePlayBtn();
    this._updateRepeatBtn();
    this.el.shuffleBtn.classList.toggle('on', this.isShuffled);

    const vol = this.audio.volume;
    this.el.volume.value = vol * 100;
    this._updateSliderFill(this.el.volume);
    this.el.muteBtn.textContent = vol === 0 ? '🔇' : '🔊';
  },

  /**
   * 플레이리스트 목록을 렌더링합니다.
   */
  _renderPlaylist() {
    const { items, count } = this.el;
    count.textContent = `(${this.playlist.length})`;

    if (this.playlist.length === 0) {
      items.innerHTML = `
        <li class="playlist-empty">
          music/playlist.json에 곡을 추가하세요.<br>
          로컬 파일(.mp3)과 외부 URL 모두 지원합니다.
        </li>`;
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

    // 클릭 이벤트 (이벤트 위임)
    items.addEventListener('click', (e) => {
      const li = e.target.closest('.playlist-item');
      if (!li) return;
      const idx = parseInt(li.dataset.index);
      this._loadTrack(idx, true);
      this.isPlaying = true;
      this._updatePlayBtn();
    });
  },

  /**
   * 플레이리스트에서 현재 곡을 강조합니다.
   */
  _updatePlaylistHighlight() {
    this.el.items.querySelectorAll('.playlist-item').forEach((li, idx) => {
      li.classList.toggle('active', idx === this.currentIndex);
    });
  },

  /**
   * 프로그레스 바를 초기화합니다.
   */
  _resetProgress() {
    this.el.progress.value = 0;
    this.el.currentTime.textContent = '0:00';
    this.el.duration.textContent = '0:00';
    this._updateSliderFill(this.el.progress, 0);
  },

  /**
   * range 슬라이더의 채워진 부분(왼쪽)을 CSS 변수로 설정합니다.
   *
   * @param {HTMLInputElement} slider - range input 요소
   * @param {number} [pct]            - 직접 퍼센트를 지정할 때 (선택사항)
   */
  _updateSliderFill(slider, pct) {
    const value = pct ?? ((parseFloat(slider.value) / parseFloat(slider.max || 100)) * 100);
    slider.style.setProperty('--pct', `${Math.max(0, Math.min(100, value))}%`);
  },

  // ══════════════════════════════════════════════════════
  // [6] 상태 저장 & 복원 (페이지 이동 대응)
  // ══════════════════════════════════════════════════════

  /**
   * 현재 재생 상태를 localStorage에 저장합니다.
   * 페이지를 떠나기 전(beforeunload)에 호출됩니다.
   */
  _saveState() {
    Storage.set(SK.INDEX,   this.currentIndex);
    Storage.set(SK.TIME,    this.audio.currentTime);
    Storage.set(SK.VOLUME,  this.audio.volume);
    Storage.set(SK.SHUFFLE, this.isShuffled);
    Storage.set(SK.REPEAT,  this.repeatMode);
  },

  /**
   * localStorage에서 이전 상태를 복원합니다.
   * 페이지 진입 시 호출됩니다.
   * 재생은 자동으로 시작하지 않습니다 (isPlaying = false).
   */
  _restoreState() {
    const savedIndex  = Storage.get(SK.INDEX,   0);
    const savedVolume = Storage.get(SK.VOLUME,  0.7);
    const savedShuffle= Storage.get(SK.SHUFFLE, false);
    const savedRepeat = Storage.get(SK.REPEAT,  'none');

    this.repeatMode = savedRepeat;
    this.isShuffled = savedShuffle;

    this.audio.volume = savedVolume;

    if (this.playlist.length > 0) {
      // 저장된 인덱스가 범위 내에 있으면 해당 곡 로드 (재생 X)
      const idx = Math.min(savedIndex, this.playlist.length - 1);
      this._loadTrack(idx, false);  // autoPlay = false → 정지 상태 유지
    }

    if (this.isShuffled) this._buildShuffleOrder();
  },
};

/**
 * 초(number)를 'M:SS' 형식의 문자열로 변환합니다.
 * @param {number} sec - 초
 * @returns {string} 예: '3:07'
 */
function formatTime(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default MusicPlayer;
