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
