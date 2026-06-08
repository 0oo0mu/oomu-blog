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
