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
