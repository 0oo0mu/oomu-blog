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
