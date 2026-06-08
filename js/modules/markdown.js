/**
 * js/modules/markdown.js — 마크다운 파서
 *
 * marked.js(CDN)를 래핑합니다.
 * marked.js가 로드되지 않은 경우 에러 메시지를 반환합니다.
 *
 * 사용법:
 *   import Markdown from './markdown.js';
 *   const html = Markdown.parse('# 제목\n본문...');
 *   const { meta, content } = Markdown.parseFrontMatter(rawText);
 */

const Markdown = {
  /**
   * 마크다운 텍스트를 HTML 문자열로 변환합니다.
   * CDN으로 불러온 window.marked를 사용합니다.
   *
   * @param {string} mdText - 마크다운 텍스트
   * @returns {string}      - 변환된 HTML
   */
  parse(mdText) {
    if (typeof window.marked === 'undefined') {
      console.error('[Markdown] marked.js가 로드되지 않았습니다.');
      return `<p>마크다운 파서를 불러올 수 없습니다.</p>`;
    }
    return window.marked.parse(mdText);
  },

  /**
   * 마크다운 파일 맨 위의 Front Matter를 파싱합니다.
   *
   * Front Matter란?
   *   ---로 감싼 영역에 제목, 날짜, 태그 등 메타데이터를 넣는 형식입니다.
   *   예:
   *     ---
   *     title: 내 첫 글
   *     date: 2024-01-15
   *     tags: [JS, CSS]
   *     ---
   *     # 본문 시작
   *
   * @param {string} raw - .md 파일 전체 텍스트
   * @returns {{ meta: Object, content: string }}
   *   - meta:    파싱된 메타데이터 (title, date, category, tags 등)
   *   - content: Front Matter를 제외한 순수 마크다운 본문
   */
  parseFrontMatter(raw) {
    const meta = {};

    // 파일이 ---\n으로 시작하는지 확인 (Front Matter 없으면 그대로 반환)
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta, content: raw };

    // Front Matter 파싱: 줄 단위로 "키: 값" 처리
    match[1].split('\n').forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return; // ':' 없는 줄은 건너뜀

      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();

      if (key === 'tags') {
        // 태그는 배열로 파싱: [JS, CSS] 또는 JS, CSS 형식 모두 지원
        meta.tags = val
          .replace(/[\[\]]/g, '')      // 대괄호 제거
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);            // 빈 문자열 제거
      } else {
        meta[key] = val;
      }
    });

    return { meta, content: match[2] };
  },
};

// marked.js 옵션 설정 (window.marked가 있을 때만)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if (window.marked) {
      window.marked.setOptions({
        gfm:    true, // GitHub Flavored Markdown (표, 취소선 등 지원)
        breaks: true, // \n을 <br>로 변환
      });
    }
  });
}

export default Markdown;
