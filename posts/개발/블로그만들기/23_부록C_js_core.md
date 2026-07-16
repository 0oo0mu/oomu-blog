---
title: [블로그 만들기] 부록 C. js/core 전체 (핵심 부품)
date: 2026-07-14
category: 개발/블로그만들기
tags: [블로그만들기, 부록, 자바스크립트, 전체코드]
excerpt: 이벤트 버스·라우터·테마·색상·환경감지·저장소 등 핵심 부품(js/core) 전체 코드입니다. config.js는 build.js가 blog.config.json으로부터 자동 생성하는 파일이라 직접 수정하지 않습니다.
---

# 부록 C — js/core 전체 (핵심 부품)

이벤트 버스·라우터·테마·색상·환경감지·저장소 등 핵심 부품(js/core) 전체 코드입니다. config.js는 build.js가 blog.config.json으로부터 자동 생성하는 파일이라 직접 수정하지 않습니다.

> 이 부록은 **실제 파일의 완전한 코드**입니다. 각 파일이 왜 그렇게 동작하는지는 해당 본편(00~20)에서 설명했고, 여기서는 그대로 옮겨 적을 수 있도록 전체를 싣습니다. 파일 경로 그대로 만들어 붙여넣으면 됩니다.

## `js/core/app.js`

````javascript
/**
 * js/core/app.js — 앱 중앙 레지스트리 & 이벤트 버스
 *
 * 모든 모듈은 App을 통해 서로 소통합니다.
 * 직접 import 대신 이벤트를 쓰면 모듈 간 결합도가 낮아져서
 * 나중에 기능을 추가/제거해도 다른 파일을 건드리지 않아도 됩니다.
 *
 * ── 사용 패턴 ──
 *
 * 모듈 등록:
 *   App.register('search', SearchModule);
 *   → SearchModule.init()이 자동으로 호출됩니다.
 *
 * 이벤트 발행:
 *   App.emit('posts:loaded', { posts: [...] });
 *
 * 이벤트 구독:
 *   App.on('posts:loaded', ({ posts }) => { ... });
 *
 * ── 현재 정의된 이벤트 목록 ──
 *   'theme:change'     → { theme: 'dark'|'light' }
 *   'posts:loaded'     → { posts: Post[] }           (posts-loader)
 *   'filter:change'    → { category, tag }            (filter)
 *   'posts:filtered'   → { posts: Post[] }            (filter)
 */

const App = {
  /** 등록된 모듈들 { 이름: 모듈객체 } */
  modules: {},

  /** 이벤트 리스너들 { 이벤트명: [콜백, ...] } */
  _listeners: {},

  /**
   * 모듈을 등록하고 초기화합니다.
   * 모듈 객체에 init() 메서드가 있으면 자동으로 호출됩니다.
   *
   * @param {string} name   - 모듈 이름 (예: 'search', 'music')
   * @param {Object} module - 모듈 객체 (init 메서드 포함 권장)
   */
  register(name, module) {
    this.modules[name] = module;
    if (typeof module.init === 'function') {
      module.init();
    }
  },

  /**
   * 이벤트를 발행합니다. 구독한 모든 콜백이 즉시 실행됩니다.
   *
   * @param {string} event - 이벤트 이름 (예: 'posts:loaded')
   * @param {*}      data  - 전달할 데이터 (선택사항)
   */
  emit(event, data) {
    const listeners = this._listeners[event] || [];
    listeners.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`[App] 이벤트 핸들러 오류 (${event}):`, e);
      }
    });
  },

  /**
   * 이벤트를 구독합니다.
   *
   * @param {string}   event - 이벤트 이름
   * @param {Function} cb    - 이벤트 발생 시 실행할 콜백 함수
   * @returns {Function} 구독 해제 함수 (off 역할)
   *
   * 사용 예:
   *   const unsubscribe = App.on('theme:change', handler);
   *   unsubscribe(); // 나중에 구독 해제
   */
  on(event, cb) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(cb);

    // 구독 해제 함수 반환
    return () => {
      this._listeners[event] = this._listeners[event].filter(fn => fn !== cb);
    };
  },

  /**
   * 등록된 모듈을 이름으로 가져옵니다.
   * 다른 모듈이 필요할 때 직접 참조용으로 사용합니다.
   *
   * @param {string} name - 모듈 이름
   * @returns {Object|undefined}
   */
  get(name) {
    return this.modules[name];
  },
};

export default App;
````


## `js/core/router.js`

````javascript
/**
 * js/core/router.js — SPA(Single Page Application) 라우터
 *
 * ── 왜 SPA인가? ──
 *   멀티 페이지 방식(index.html → post.html → index.html)은
 *   페이지 이동마다 브라우저가 전체를 새로 로드합니다.
 *   이때 오디오 엘리먼트도 파괴되어 음악이 끊깁니다.
 *
 *   SPA는 실제로는 페이지 이동 없이 콘텐츠만 교체합니다.
 *   뮤직 플레이어, 사이드바, 헤더가 전혀 건드려지지 않으므로
 *   음악이 끊기지 않습니다.
 *
 * ── 동작 방식 ──
 *   1. 카드 클릭 → goPost(file) 호출
 *   2. history.pushState로 URL만 변경 (페이지 이동 없음)
 *   3. #listView 숨기고 #postView 표시
 *   4. App.emit('router:post') → app-index.js가 포스트 로딩
 *
 *   뒤로가기 클릭 → popstate 이벤트 → goList()
 *   ← 목록으로 클릭 → goList()
 *
 * 발행하는 이벤트:
 *   'router:post' → { file: string }   포스트 뷰 전환 요청
 *   'router:list' → {}                  목록 뷰 전환 요청
 */

import App from './app.js';

const Router = {
  /** 뒤로가기 시 목록 스크롤 위치 복원을 위해 저장 */
  _savedScrollY: 0,

  /**
   * 초기화:
   *   - 초기 URL에 ?file= 파라미터가 있으면 포스트 뷰로 시작
   *   - 클릭 이벤트 위임 (포스트 카드, 뒤로가기 버튼)
   *   - 브라우저 뒤로/앞으로 버튼(popstate) 처리
   */
  init() {
    // ── 초기 URL 처리 ──
    // 누군가 ?file=... URL로 직접 접근한 경우 포스트 뷰로 시작
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    if (file) {
      // history는 건드리지 않고 뷰만 전환
      this._applyView('post', { file }, false);
    } else {
      this._applyView('list', {}, false);
    }

    // ── 클릭 이벤트 위임 ──
    // 문서 전체에 한 번만 달아서, 동적으로 생성되는 카드에도 적용됩니다.
    document.addEventListener('click', (e) => {
      // 포스트 카드 클릭
      const card = e.target.closest('.post-card[data-file]');
      if (card) {
        e.preventDefault();
        this.goPost(card.dataset.file);
        return;
      }

      // ← 목록으로 버튼 클릭
      if (e.target.closest('#backBtn')) {
        e.preventDefault();
        this.goList();
      }
    });

    // ── 브라우저 뒤로/앞으로 버튼 ──
    window.addEventListener('popstate', (e) => {
      const state = e.state || { view: 'list' };
      this._applyView(state.view, state, false);
    });
  },

  /**
   * 포스트 뷰로 이동합니다.
   * URL을 ?file=... 로 변경하고 포스트 콘텐츠를 로드합니다.
   *
   * @param {string} file - posts/ 기준 상대 경로 (예: 'PC/언어/c-basics.md')
   */
  goPost(file) {
    this._savedScrollY = window.scrollY; // 목록 스크롤 위치 저장
    history.pushState({ view: 'post', file }, '', `?file=${encodeURIComponent(file)}`);
    this._applyView('post', { file }, true);
  },

  /**
   * 목록 뷰로 돌아갑니다.
   * URL을 index.html 로 변경하고 이전 스크롤 위치를 복원합니다.
   */
  goList() {
    history.pushState({ view: 'list' }, '', 'index.html');
    this._applyView('list', {}, true);
  },

  /**
   * 뷰를 전환합니다. (내부 메서드)
   * #listView와 #postView를 표시/숨김 처리합니다.
   *
   * @param {'list'|'post'} view - 표시할 뷰
   * @param {Object}        data - 뷰에 전달할 데이터 (file 등)
   * @param {boolean}       scroll - true면 맨 위로 스크롤
   */
  _applyView(view, data, scroll) {
    const listEl = document.getElementById('listView');
    const postEl = document.getElementById('postView');

    if (view === 'post') {
      // 목록 숨기고 포스트 표시
      listEl?.classList.add('view-hidden');
      postEl?.classList.remove('view-hidden');
      App.emit('router:post', { file: data.file });

      if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });

    } else {
      // 포스트 숨기고 목록 표시
      postEl?.classList.add('view-hidden');
      listEl?.classList.remove('view-hidden');
      App.emit('router:list', {});

      // 목록 스크롤 위치 복원 (뒤로가기 시 이전 위치로)
      if (scroll) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: this._savedScrollY, behavior: 'instant' });
        });
      }
    }
  },
};

export default Router;
````


## `js/core/theme.js`

````javascript
/**
 * js/core/theme.js — 다크/라이트 테마 관리
 *
 * 핵심 설계:
 *   - dark 클래스를 <html>(documentElement)에 붙입니다.
 *   - CSS는 :root.dark 로 매칭합니다.
 *   - 페이지 전환 시 섬광(하얀 번쩍임)을 막기 위해
 *     각 HTML 파일의 <head>에 인라인 스크립트가 있고,
 *     그 스크립트도 documentElement에 dark 클래스를 붙입니다.
 *     → CSS가 로드되기 전에 다크모드 변수가 이미 활성화됨.
 */

import Storage from './storage.js';
import App from './app.js';

const STORAGE_KEY = 'theme';

const Theme = {
  /**
   * 초기화: 저장된 테마 적용 + 토글 버튼 이벤트 연결
   */
  init() {
    const saved = Storage.get(STORAGE_KEY, 'light');
    this._apply(saved);

    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => this.toggle());
  },

  /**
   * 테마를 전환합니다.
   */
  toggle() {
    // documentElement 기준으로 현재 상태 판단 (인라인 스크립트와 동일 기준)
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    this._apply(next);
    Storage.set(STORAGE_KEY, next);
    App.emit('theme:change', { theme: next });
  },

  /**
   * 현재 테마를 반환합니다.
   * @returns {'dark'|'light'}
   */
  current() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  },

  /**
   * 테마를 DOM에 적용합니다. (내부 메서드)
   *
   * documentElement(<html>)에 클래스를 붙이는 이유:
   *   인라인 스크립트는 <head>에서 실행되는데,
   *   이 시점엔 <body>가 아직 파싱되지 않았습니다.
   *   document.body는 null이지만 document.documentElement는 항상 사용 가능합니다.
   *   CSS의 :root.dark 가 <html> 기준이므로 여기에 붙여야 합니다.
   *
   * @param {'dark'|'light'} theme
   */
  _apply(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      this._setButton('☀️', '라이트');
    } else {
      document.documentElement.classList.remove('dark');
      this._setButton('🌙', '다크');
    }
  },

  /** @param {string} icon @param {string} label */
  _setButton(icon, label) {
    const iconEl  = document.getElementById('themeIcon');
    const labelEl = document.getElementById('themeLabel');
    if (iconEl)  iconEl.textContent  = icon;
    if (labelEl) labelEl.textContent = label;
  },
};

export default Theme;
````


## `js/core/accent.js`

````javascript
/**
 * js/core/accent.js — 프리셋 컬러 테마 관리
 *
 * 자유 색상 선택 대신 8가지 미리 정의된 테마를 제공합니다.
 * 각 프리셋은 --accent(포인트 컬러)와 --accent-light(배경용 연한 색)를
 * 함께 정의하므로 사이드바·카드·버튼 등 모든 곳에서 일관되게 보입니다.
 *
 * 사용법:
 *   import Accent from './accent.js';
 *   Accent.init(); // 페이지 로드 시 한 번 호출
 */

import Storage from './storage.js';

const STORAGE_KEY = 'accent_preset'; // 선택한 프리셋 인덱스 저장 키

/**
 * 색상 프리셋 목록.
 * --accent: 버튼·링크·강조에 쓰이는 주 컬러
 * --accent-light: 배경·호버에 쓰이는 연한 컬러 (라이트·다크 모두 어울리게 조정)
 */
const PRESETS = [
  { name: '인디고', accent: '#6366f1', light: 'rgba(99,102,241,0.13)'  },
  { name: '블루',   accent: '#3b82f6', light: 'rgba(59,130,246,0.13)'  },
  { name: '에메랄드', accent: '#10b981', light: 'rgba(16,185,129,0.13)' },
  { name: '티얼',   accent: '#06b6d4', light: 'rgba(6,182,212,0.13)'   },
  { name: '보라',   accent: '#8b5cf6', light: 'rgba(139,92,246,0.13)'  },
  { name: '핑크',   accent: '#ec4899', light: 'rgba(236,72,153,0.13)'  },
  { name: '로즈',   accent: '#f43f5e', light: 'rgba(244,63,94,0.13)'   },
  { name: '오렌지', accent: '#f97316', light: 'rgba(249,115,22,0.13)'  },
];

const Accent = {
  /** 현재 선택된 프리셋 인덱스 */
  _current: 0,

  /**
   * 초기화: 저장된 프리셋 적용 + 팝업 생성 + 버튼 이벤트 연결
   */
  init() {
    this._current = Storage.get(STORAGE_KEY, 0);
    // 범위 체크 (저장값이 유효하지 않으면 0으로)
    if (this._current < 0 || this._current >= PRESETS.length) {
      this._current = 0;
    }

    this._apply(this._current);
    this._buildPopup();
    this._bindEvents();
  },

  /**
   * 특정 프리셋을 CSS 변수에 적용합니다.
   * @param {number} index - PRESETS 배열 인덱스
   */
  _apply(index) {
    const preset = PRESETS[index];
    if (!preset) return;

    const root = document.documentElement;
    root.style.setProperty('--accent',       preset.accent);
    root.style.setProperty('--accent-light', preset.light);

    // 헤더의 색상 점 업데이트 (각 페이지마다 여러 개 있을 수 있음)
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.style.background = preset.accent;
    });
  },

  /**
   * 색상 선택 팝업 내부를 빌드합니다.
   * id="colorPresetPopup" 요소가 있어야 합니다.
   */
  _buildPopup() {
    const popup = document.getElementById('colorPresetPopup');
    if (!popup) return;

    popup.innerHTML = PRESETS.map((p, i) => `
      <button
        class="preset-swatch ${i === this._current ? 'active' : ''}"
        data-index="${i}"
        title="${p.name}"
        style="background: ${p.accent};"
      ></button>
    `).join('');
  },

  /**
   * 버튼 클릭 이벤트를 연결합니다.
   */
  _bindEvents() {
    const btn   = document.getElementById('colorPresetBtn');
    const popup = document.getElementById('colorPresetPopup');
    const wrap  = document.getElementById('colorPresetWrap');
    if (!btn || !popup || !wrap) return;

    // ── 버튼 클릭: 팝업 열기/닫기 ──
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = popup.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
    });

    // ── 스와치 클릭: 프리셋 적용 ──
    popup.addEventListener('click', (e) => {
      const swatch = e.target.closest('.preset-swatch');
      if (!swatch) return;

      const index = parseInt(swatch.dataset.index, 10);
      this._current = index;
      this._apply(index);
      Storage.set(STORAGE_KEY, index);

      // 활성 스와치 표시 업데이트
      popup.querySelectorAll('.preset-swatch').forEach((s, i) => {
        s.classList.toggle('active', i === index);
      });

      // 팝업 닫기
      popup.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });

    // ── 팝업 바깥 클릭: 팝업 닫기 ──
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        popup.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  },

  /**
   * 현재 선택된 프리셋을 반환합니다.
   * @returns {{ name, accent, light }}
   */
  current() {
    return PRESETS[this._current];
  },

  /**
   * 인라인 스크립트(섬광 방지)에서 저장값을 읽어 즉시 적용할 수 있도록
   * 프리셋 데이터를 직렬화된 형태로 노출합니다.
   * HTML head의 인라인 스크립트에서 사용됩니다.
   */
  getPresetsForInline() {
    return PRESETS;
  },
};

export { PRESETS };
export default Accent;
````


## `js/core/env.js`

````javascript
/**
 * js/core/env.js — 실행 환경 감지
 *
 * 로컬(개발) 환경인지 배포된 웹 환경인지 구분합니다.
 * 이 값을 기반으로:
 *   - 로컬: 에디터 "글쓰기" 버튼을 헤더에 표시
 *   - 웹:   "글쓰기" 버튼을 숨김 (방문자가 글을 쓸 수 없으므로)
 *
 * 사용법:
 *   import Env from './env.js';
 *   if (Env.isLocal) { ... }
 */

const Env = {
  /**
   * 로컬 환경 여부.
   * hostname이 localhost, 127.0.0.1, 또는 빈 문자열(file://)이면 true.
   * @type {boolean}
   */
  isLocal: ['localhost', '127.0.0.1', ''].includes(window.location.hostname),

  /**
   * 현재 환경 이름.
   * @returns {'local'|'web'}
   */
  get name() {
    return this.isLocal ? 'local' : 'web';
  },

  /**
   * 사이트 기준 URL.
   * 로컬이면 현재 origin, 배포 환경이면 window.location.origin.
   * @returns {string}
   */
  get baseUrl() {
    return window.location.origin;
  },
};

export default Env;
````


## `js/core/storage.js`

````javascript
/**
 * js/core/storage.js — localStorage 래퍼
 *
 * localStorage를 직접 쓰면 try/catch가 매번 필요하고
 * 흩어지기 쉬워서, 여기서 한 곳에서 관리합니다.
 *
 * 사용법:
 *   import Storage from './storage.js';
 *   Storage.set('theme', 'dark');
 *   Storage.get('theme', 'light'); // 기본값 'light'
 */

const Storage = {
  /**
   * 값을 저장합니다.
   * @param {string} key   - 저장 키
   * @param {*}      value - 저장할 값 (자동으로 JSON.stringify)
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Storage] 저장 실패:', key, e);
    }
  },

  /**
   * 저장된 값을 가져옵니다.
   * @param {string} key          - 조회 키
   * @param {*}      defaultValue - 값이 없을 때 반환할 기본값
   * @returns {*} 저장된 값 또는 defaultValue
   */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      console.warn('[Storage] 읽기 실패:', key, e);
      return defaultValue;
    }
  },

  /**
   * 저장된 값을 삭제합니다.
   * @param {string} key - 삭제할 키
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Storage] 삭제 실패:', key, e);
    }
  },
};

export default Storage;
````


## `js/core/config.js`

````javascript
// ⚠️ 이 파일은 build.js가 blog.config.json을 읽어서 자동 생성합니다.
// 직접 수정하지 말고, blog.config.json을 수정 후 node build.js를 실행하세요.
const Config = {
  "siteName": "My Blog",
  "siteUrl": "https://yourblog.com",
  "description": "개발과 일상을 기록하는 블로그",
  "author": "작성자 이름",
  "language": "ko",
  "social": {
    "github": "",
    "twitter": "",
    "email": ""
  }
};
export default Config;
````

