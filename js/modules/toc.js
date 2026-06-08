/**
 * js/modules/toc.js — 목차(Table of Contents) 생성 & 스크롤 감지
 *
 * ── 하이라이트 알고리즘 ──
 * IntersectionObserver는 heading이 "화면에 들어올 때"만 감지하기 때문에
 * 섹션이 길 경우 heading이 위로 사라진 뒤 하이라이트가 꺼지는 문제가 있습니다.
 *
 * 대신 scroll 이벤트를 사용합니다:
 *   → 현재 스크롤 위치에서 "이미 지나친" heading 중 가장 마지막 것 = 현재 섹션
 *   → 클릭 시에도 즉시 active 반영
 */

const Toc = {
  /** requestAnimationFrame ID (스크롤 이벤트 최적화용) */
  _rafId: null,

  /** 스크롤 이벤트 리스너 참조 (cleanup 시 제거용) */
  _scrollHandler: null,

  /** 현재 페이지의 heading 목록 */
  _headings: [],

  /**
   * 목차를 생성합니다.
   * 이전 목차가 있으면 먼저 정리(cleanup)한 뒤 새로 만듭니다.
   *
   * @param {Object} options
   * @param {string} options.bodyId    - 본문 컨테이너 id (기본: 'postBody')
   * @param {string} options.tocId     - 목차 리스트 id (기본: 'tocList')
   * @param {string} options.sidebarId - 목차 사이드바 id (기본: 'tocSidebar')
   */
  build({ bodyId = 'postBody', tocId = 'tocList', sidebarId = 'tocSidebar' } = {}) {
    this._cleanup();

    const body    = document.getElementById(bodyId);
    const tocList = document.getElementById(tocId);
    const sidebar = document.getElementById(sidebarId);
    if (!body || !tocList || !sidebar) return;

    // h2, h3, h4만 목차에 포함 (h1은 포스트 제목으로 사용)
    const headings = Array.from(body.querySelectorAll('h2, h3, h4'));

    if (headings.length === 0) {
      sidebar.style.display = 'none';
      return;
    }

    sidebar.style.display = '';
    tocList.innerHTML = '';

    // ── heading마다 id 부여 + 목차 항목 생성 ──
    headings.forEach((heading, idx) => {
      // id: 인덱스 + 텍스트(소문자화, 특수문자 제거, 공백→하이픈)
      const id = `h-${idx}-` + heading.textContent
        .toLowerCase()
        .replace(/[^\w\s가-힣]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 40);

      heading.id = id;

      const level = parseInt(heading.tagName[1]); // 2, 3, 또는 4
      const li = document.createElement('li');
      li.className = `toc-item level-${level}`;

      const a = document.createElement('a');
      a.href = `#${id}`;
      a.textContent = heading.textContent;

      // ── 클릭: 즉시 active 설정 + 부드럽게 스크롤 ──
      a.addEventListener('click', (e) => {
        e.preventDefault();

        // Observer 응답을 기다리지 않고 즉시 하이라이트
        this._setActive(tocList, id);

        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      li.appendChild(a);
      tocList.appendChild(li);
    });

    this._headings = headings;

    // ── 스크롤 이벤트로 현재 섹션 감지 ──
    this._scrollHandler = () => {
      // requestAnimationFrame: 스크롤 이벤트가 너무 자주 발생하면
      // 프레임당 한 번만 실행되도록 제한 (성능 최적화)
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = requestAnimationFrame(() => {
        this._updateActive(tocList);
      });
    };

    window.addEventListener('scroll', this._scrollHandler, { passive: true });

    // 페이지 첫 로드 시 초기 상태 반영 (스크롤 없이도 하이라이트)
    this._updateActive(tocList);
  },

  /**
   * 현재 스크롤 위치 기준으로 active heading을 계산합니다. (내부 메서드)
   *
   * 알고리즘:
   *   헤더 높이 + 여유 16px 아래 기준선을 정하고,
   *   기준선보다 위에 있는(= 이미 지나친) heading 중 가장 마지막 것을 active로 봅니다.
   *   → 어떤 섹션 안에 있든 그 섹션의 heading이 항상 하이라이트됩니다.
   *
   * @param {HTMLElement} tocList - 목차 ul 요소
   */
  _updateActive(tocList) {
    // 헤더 높이 (CSS 변수에서 읽거나 60px로 폴백)
    const headerHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '60'
    );
    // 스크롤 기준선: 헤더 바로 아래 + 16px 여유
    const threshold = window.scrollY + headerHeight + 16;

    // 기준선을 지나친 heading을 모두 찾고, 그 중 가장 아래 것(= 현재 섹션)
    let activeId = null;
    for (const heading of this._headings) {
      // offsetTop: 페이지 최상단으로부터의 거리
      if (heading.offsetTop <= threshold) {
        activeId = heading.id;
      } else {
        break; // heading들이 위→아래 순서이므로 넘으면 더 볼 필요 없음
      }
    }

    if (activeId) {
      this._setActive(tocList, activeId);
    }
  },

  /**
   * 특정 id에 해당하는 목차 링크를 active로 설정합니다. (내부 메서드)
   * 기존 active는 모두 제거하고 해당 링크만 활성화합니다.
   *
   * @param {HTMLElement} tocList - 목차 ul 요소
   * @param {string}      id      - 활성화할 heading의 id
   */
  _setActive(tocList, id) {
    tocList.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
    const link = tocList.querySelector(`a[href="#${id}"]`);
    if (link) {
      link.classList.add('active');

      // ToC 사이드바 안에서도 active 항목이 보이도록 스크롤
      link.scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * 이벤트 리스너와 RAF를 해제합니다. (내부 메서드)
   * 포스트를 재로드할 때 메모리 누수 방지용
   */
  _cleanup() {
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler);
      this._scrollHandler = null;
    }
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._headings = [];
  },
};

export default Toc;
