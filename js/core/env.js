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
