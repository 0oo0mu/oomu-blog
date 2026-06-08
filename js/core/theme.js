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
