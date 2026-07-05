/**
 * js/modules/search.js — 실시간 검색 모듈
 *
 * 사용자가 검색어를 입력하면 'filter:search' 이벤트를 발행합니다.
 * filter.js가 이 이벤트를 받아서 카테고리/태그 필터와 함께 포스트를 걸러냅니다.
 *
 * 검색 범위: 제목, 요약(excerpt), 카테고리, 태그
 *
 * 발행하는 이벤트:
 *   'filter:search' → { query: string }
 *
 * HTML에 필요한 요소:
 *   #searchInput  - 텍스트 입력
 *   #searchClear  - X 지우기 버튼
 */

import App from '../core/app.js';

const Search = {
  /**
   * 초기화: 검색 입력 이벤트 연결
   * App.register('search', Search) 시 자동 호출됩니다.
   */
  init() {
    const input    = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');
    if (!input) return;

    /**
     * 디바운스 타이머 ID.
     * 타이핑이 멈추고 200ms 후에 검색을 실행합니다.
     * (키를 누를 때마다 즉시 실행하면 너무 자주 필터링됨)
     */
    let debounce = null;

    /**
     * 숨은 명령어: 검색창에 이 단어를 그대로 입력하면
     * 글쓰기(에디터) 페이지로 이동합니다.
     * 헤더에 눈에 띄는 글쓰기 버튼을 두지 않으려는 용도라
     * 방문자는 모르고, 작성자만 아는 진입점 역할을 합니다.
     */
    const EDITOR_COMMAND = '글쓰기';

    // ── 입력 이벤트 ──
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const query = input.value.trim();

        // 숨은 명령어 감지 → 에디터로 이동 (검색은 실행하지 않음)
        if (query === EDITOR_COMMAND) {
          input.value = '';
          if (clearBtn) clearBtn.style.display = 'none';
          window.location.href = 'editor.html';
          return;
        }

        // X 버튼 표시/숨김
        if (clearBtn) {
          clearBtn.style.display = query ? 'flex' : 'none';
        }

        // 검색 이벤트 발행
        App.emit('filter:search', { query });
      }, 200);
    });

    // ── X 지우기 버튼 ──
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        App.emit('filter:search', { query: '' });
        input.focus(); // 지운 후 바로 다시 입력할 수 있도록 포커스
      });
    }

    // ── Escape 키로 검색 초기화 ──
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        if (clearBtn) clearBtn.style.display