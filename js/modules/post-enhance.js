/**
 * js/modules/post-enhance.js — 렌더된 포스트 본문 후처리
 *
 * 마크다운 → HTML 변환 후(Markdown.parse), 본문 DOM에 두 가지를 입힙니다.
 *
 *   1) 코드 블록 하이라이팅 (노션 스타일)
 *      - highlight.js(CDN, window.hljs)로 문법 색 입힘
 *      - 코드블록 위에 헤더바(언어 라벨 + 복사 버튼) 추가
 *      - 색상은 css/code.css에서 라이트/다크 테마 변수로 정의됨
 *
 *   2) 헤더 토글 (접기/펼치기)
 *      - h2/h3/h4를 클릭하면 그 아래 내용(다음 헤더 전까지)이 접히고 펼쳐짐
 *      - 헤더 왼쪽에 ▾ 셰브론이 붙고, 접힌 상태면 회전
 *
 * 사용법:
 *   import PostEnhance from './modules/post-enhance.js';
 *   PostEnhance.apply(document.getElementById('postBody'));
 *
 * 주의:
 *   - Toc.build() 이후에 호출해도 heading의 id는 그대로 유지됩니다
 *     (헤더 요소 자체는 건드리지 않고, 뒤따르는 내용만 래핑하므로).
 *   - highlight.js가 없으면(로드 실패) 하이라이팅은 조용히 건너뜁니다.
 */

const PostEnhance = {
  /**
   * 본문 컨테이너에 하이라이팅 + 헤더 토글을 적용합니다.
   * @param {HTMLElement} bodyEl - 포스트 본문 요소 (#postBody)
   */
  apply(bodyEl) {
    if (!bodyEl) return;
    this._highlightCode(bodyEl);
    this._makeCollapsibleHeaders(bodyEl);
  },

  // ══════════════════════════════════════════════════════
  // [1] 코드 블록 하이라이팅 + 노션식 헤더바
  // ══════════════════════════════════════════════════════

  _highlightCode(bodyEl) {
    const blocks = bodyEl.querySelectorAll('pre code');

    blocks.forEach(code => {
      const pre = code.closest('pre');
      if (!pre || pre.parentElement.classList.contains('code-block')) return; // 중복 처리 방지

      // 언어 감지: marked가 붙인 language-xxx 클래스에서 추출
      const langClass = [...code.classList].find(c => c.startsWith('language-'));
      const lang = langClass ? langClass.replace('language-', '') : '';

      // highlight.js 적용 (없으면 건너뜀 → 색 없는 코드로 표시)
      if (window.hljs) {
        try { window.hljs.highlightElement(code); } catch (_) { /* noop */ }
      }

      // ── 노션식 래핑: .code-block > (.code-block-head + pre) ──
      const block = document.createElement('div');
      block.className = 'code-block';
      pre.replaceWith(block);

      const head = document.createElement('div');
      head.className = 'code-block-head';

      const label = document.createElement('span');
      label.className = 'code-lang';
      label.textContent = (lang || 'code').toUpperCase();

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy';
      copyBtn.type = 'button';
      copyBtn.textContent = '복사';
      copyBtn.addEventListener('click', () => this._copy(code.textContent, copyBtn));

      head.append(label, copyBtn);
      block.append(head, pre);
    });
  },

  /**
   * 클립보드 복사. clipboard API 실패 시(file:// 등) execCommand로 폴백.
   */
  _copy(text, btn) {
    const done = () => {
      const orig = '복사';
      btn.textContent = '복사됨!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this._copyFallback(text, done));
    } else {
      this._copyFallback(text, done);
    }
  },

  _copyFallback(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (_) { /* noop */ }
    document.body.removeChild(ta);
  },

  // ══════════════════════════════════════════════════════
  // [2] 헤더 토글 (접기/펼치기)
  // ══════════════════════════════════════════════════════

  _makeCollapsibleHeaders(bodyEl) {
    const headers = bodyEl.querySelectorAll('h2, h3, h4');

    headers.forEach(header => {
      // 이 헤더 다음부터 "다음 헤더(h1~h4) 직전"까지의 형제 요소를 모읍니다.
      const content = [];
      let sib = header.nextElementSibling;
      while (sib && !/^H[1-4]$/.test(sib.tagName)) {
        content.push(sib);
        sib = sib.nextElementSibling;
      }

      // 접을 내용을 감쌀 래퍼를 헤더 바로 뒤에 삽입하고 내용을 이동
      const wrapper = document.createElement('div');
      wrapper.className = 'toggle-content';
      header.after(wrapper);
      content.forEach(el => wrapper.appendChild(el));

      header.classList.add('toggle-header');

      // 클릭 → 접기/펼치기 토글
      header.addEventListener('click', () => {
        const collapsed = header.classList.toggle('collapsed');
        wrapper.classList.toggle('collapsed', collapsed);
      });
    });
  },
};

export default PostEnhance;
