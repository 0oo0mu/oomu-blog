/**
 * js/modules/graph.js — Obsidian 스타일 연결 그래프
 *
 * 기능:
 *   - 모든 포스트·카테고리·태그를 노드로 표시
 *   - D3 force simulation으로 동적 배치
 *   - 현재 보고 있는 포스트 노드가 크게 강조됨
 *   - 노드 클릭 시 해당 포스트로 이동
 *   - 드래그·줌·패닝 지원
 *   - 헤더의 🕸 그래프 버튼으로 열기/닫기
 */

import App    from '../core/app.js';
import Router from '../core/router.js';

const Graph = {
  _posts:      [],
  _currentFile: null,
  _isVisible:  false,
  _sim:        null,   // D3 simulation 인스턴스
  _d3:         null,   // window.d3 참조

  // ─────────────────────────────────────────
  // [1] 초기화
  // ─────────────────────────────────────────

  init() {
    // 포스트 데이터 수신
    App.on('posts:loaded', ({ posts }) => {
      this._posts = posts;
    });

    // 현재 포스트 추적
    App.on('router:post', ({ file }) => {
      this._currentFile = file;
      if (this._isVisible) this._rebuild();
    });

    App.on('router:list', () => {
      this._currentFile = null;
      if (this._isVisible) this._rebuild();
    });

    this._createButton();
    this._createOverlay();
  },

  // ─────────────────────────────────────────
  // [2] UI 생성
  // ─────────────────────────────────────────

  /** 헤더에 🕸 그래프 버튼 추가 */
  _createButton() {
    const controls = document.querySelector('.header-controls');
    if (!controls) return;

    const btn = document.createElement('button');
    btn.className  = 'theme-toggle';
    btn.id         = 'graphBtn';
    btn.title      = '연결 그래프 보기';
    btn.innerHTML  = '<span>🕸</span><span>그래프</span>';
    btn.addEventListener('click', () => this.toggle());

    // 색상 버튼 앞에 삽입
    const colorWrap = document.getElementById('colorPresetWrap');
    controls.insertBefore(btn, colorWrap);
  },

  /** 전체화면 오버레이 생성 */
  _createOverlay() {
    const el = document.createElement('div');
    el.id = 'graphOverlay';
    el.innerHTML = `
      <div class="graph-topbar">
        <div class="graph-topbar-left">
          <span class="graph-title">🕸 연결 그래프</span>
          <div class="graph-legend">
            <span class="legend-item">
              <svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="var(--accent)"/></svg>현재 글
            </span>
            <span class="legend-item">
              <svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="var(--graph-post)"/></svg>글
            </span>
            <span class="legend-item">
              <svg width="12" height="12"><rect width="12" height="12" rx="3" fill="var(--graph-cat)"/></svg>카테고리
            </span>
          </div>
        </div>
        <div class="graph-topbar-right">
          <span class="graph-hint">드래그 이동 · 스크롤 확대 · 노드 클릭으로 글 열기</span>
          <button class="graph-close-btn" id="graphClose" title="닫기">✕</button>
        </div>
      </div>
      <div class="graph-canvas-wrap">
        <svg id="graphSvg"></svg>
        <div id="graphTooltip" class="graph-tooltip"></div>
      </div>
    `;
    document.body.appendChild(el);

    document.getElementById('graphClose')
      .addEventListener('click', () => this.close());

    // 리사이즈 시 SVG 크기 갱신
    window.addEventListener('resize', () => {
      if (this._isVisible) this._resizeSvg();
    });
  },

  // ─────────────────────────────────────────
  // [3] 열기 / 닫기
  // ─────────────────────────────────────────

  toggle() {
    this._isVisible ? this.close() : this.open();
  },

  open() {
    this._loadD3().then(() => {
      this._isVisible = true;
      document.getElementById('graphOverlay').classList.add('open');
      document.getElementById('graphBtn').classList.add('active');
      document.body.style.overflow = 'hidden';
      this._rebuild();
    });
  },

  close() {
    this._isVisible = false;
    document.getElementById('graphOverlay').classList.remove('open');
    document.getElementById('graphBtn').classList.remove('active');
    document.body.style.overflow = '';
    if (this._sim) { this._sim.stop(); this._sim = null; }
    const svg = document.getElementById('graphSvg');
    if (svg) svg.innerHTML = '';
  },

  /** D3 v7 CDN에서 동적 로드 (이미 로드됐으면 스킵) */
  _loadD3() {
    if (window.d3) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
      s.onload  = resolve;
      s.onerror = () => reject(new Error('D3 로드 실패'));
      document.head.appendChild(s);
    });
  },

  // ─────────────────────────────────────────
  // [4] 그래프 데이터 빌드
  // ─────────────────────────────────────────

  /**
   * posts 배열에서 노드·링크 데이터를 만듭니다.
   *
   * 노드 타입:
   *   'post'     — 개별 글. 현재 보는 글은 r이 크고 accent 색.
   *   'category' — 카테고리 폴더 노드.
   *
   * 링크 타입:
   *   'cat' — 카테고리 계층(부모→자식) 또는 포스트↔카테고리
   */
  _buildData() {
    const posts = this._posts;
    const nodes = [];
    const links = [];
    const byId  = {};   // id → node (링크 연결용)

    const add = (node) => { nodes.push(node); byId[node.id] = node; return node; };

    // ── 카테고리 노드 & 계층 링크 ──
    const catSet = new Set();
    posts.forEach(p => {
      if (!p.category) return;
      p.category.split('/').reduce((acc, part) => {
        const full = acc ? `${acc}/${part}` : part;
        catSet.add(full);
        return full;
      }, '');
    });

    catSet.forEach(cat => {
      const parts = cat.split('/');
      add({ id: `cat:${cat}`, type: 'category', label: parts[parts.length - 1], r: 13, isCurrent: false });
    });

    // 부모 카테고리 → 자식 카테고리 링크
    catSet.forEach(cat => {
      const parts = cat.split('/');
      if (parts.length > 1) {
        const parent = parts.slice(0, -1).join('/');
        links.push({ source: `cat:${parent}`, target: `cat:${cat}`, ltype: 'cat', dist: 60 });
      }
    });

    // ── 포스트 노드 & 카테고리 링크 ──
    posts.forEach(p => {
      const isCurrent = (p.file === this._currentFile);
      const baseR     = isCurrent ? 20 : 8;

      add({ id: `post:${p.file}`, type: 'post', label: p.title || p.file, file: p.file, r: baseR, isCurrent });

      if (p.category && byId[`cat:${p.category}`]) {
        links.push({ source: `cat:${p.category}`, target: `post:${p.file}`, ltype: 'cat', dist: 80 });
      }
    });

    return { nodes, links };
  },

  // ─────────────────────────────────────────
  // [5] D3 렌더링
  // ─────────────────────────────────────────

  _rebuild() {
    if (this._sim) { this._sim.stop(); this._sim = null; }
    const svgEl = document.getElementById('graphSvg');
    if (!svgEl) return;
    svgEl.innerHTML = '';

    const { nodes, links } = this._buildData();
    if (!nodes.length) return;

    this._resizeSvg();
    const W = svgEl.clientWidth  || svgEl.getBoundingClientRect().width;
    const H = svgEl.clientHeight || svgEl.getBoundingClientRect().height;

    const d3  = window.d3;
    const svg = d3.select('#graphSvg');

    // ── 배경 클릭: 드래그한 게 아니면 닫지 않음 (그냥 포커스 해제용)
    svg.on('click', () => {});

    // ── 줌/패닝 ──
    const g    = svg.append('g').attr('class', 'graph-root');
    const zoom = d3.zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', (ev) => g.attr('transform', ev.transform));

    svg.call(zoom)
       .call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2));

    // ── 링크 ──
    const linkSel = g.append('g').attr('class', 'g-links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', d => `graph-link graph-link-${d.ltype}`);

    // ── 노드 그룹 ──
    const nodeSel = g.append('g').attr('class', 'g-nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', d => `g-node g-node-${d.type}${d.isCurrent ? ' g-node-current' : ''}`)
      .call(
        d3.drag()
          .on('start', (ev, d) => {
            if (!ev.active) this._sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
          .on('end',  (ev, d) => {
            if (!ev.active) this._sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // ── 현재 글 글로우 링 ──
    nodeSel.filter(d => d.isCurrent)
      .append('circle')
      .attr('class', 'node-glow')
      .attr('r', d => d.r + 8);

    // ── 카테고리 노드: 둥근 사각형 ──
    nodeSel.filter(d => d.type === 'category')
      .append('rect')
      .attr('class', 'node-shape')
      .attr('width',  d => d.r * 2.2)
      .attr('height', d => d.r * 2.2)
      .attr('x', d => -d.r * 1.1)
      .attr('y', d => -d.r * 1.1)
      .attr('rx', 4);

    // ── 포스트·태그 노드: 원 ──
    nodeSel.filter(d => d.type !== 'category')
      .append('circle')
      .attr('class', 'node-shape')
      .attr('r', d => d.r);

    // ── 라벨 ──
    nodeSel.append('text')
      .attr('class', 'node-label')
      .attr('dy', d => d.r + 13)
      .attr('text-anchor', 'middle')
      .text(d => {
        // 카테고리·현재 글·태그는 항상 표시
        if (d.type === 'category' || d.type === 'tag' || d.isCurrent) return d.label;
        // 일반 포스트: 글자 수 제한
        return d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label;
      });

    // ── 포스트 클릭 → 글 열기 ──
    nodeSel.filter(d => d.type === 'post')
      .style('cursor', 'pointer')
      .on('click', (ev, d) => {
        ev.stopPropagation();
        this.close();
        Router.goPost(d.file);
      });

    // ── 툴팁 ──
    const tooltip = document.getElementById('graphTooltip');
    nodeSel
      .on('mouseenter', (ev, d) => {
        tooltip.textContent = d.label;
        tooltip.style.display = 'block';
        this._moveTooltip(ev);
      })
      .on('mousemove', (ev) => this._moveTooltip(ev))
      .on('mouseleave', () => { tooltip.style.display = 'none'; });

    // ── Force Simulation ──
    this._sim = d3.forceSimulation(nodes)
      .force('link',
        d3.forceLink(links)
          .id(d => d.id)
          .distance(d => d.dist || 80)
          .strength(0.7)
      )
      .force('charge', d3.forceManyBody().strength(d => {
        if (d.type === 'category') return -350;
        if (d.isCurrent)          return -280;
        return -120;
      }))
      .force('collision', d3.forceCollide(d => d.r + 6))
      .force('x', d3.forceX(0).strength(0.04))
      .force('y', d3.forceY(0).strength(0.04))
      .on('tick', () => {
        linkSel
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });
  },

  /** SVG를 캔버스 컨테이너에 맞게 크기 설정 */
  _resizeSvg() {
    const wrap = document.querySelector('.graph-canvas-wrap');
    const svg  = document.getElementById('graphSvg');
    if (!wrap || !svg) return;
    svg.setAttribute('width',  wrap.clientWidth);
    svg.setAttribute('height', wrap.clientHeight);
  },

  _moveTooltip(ev) {
    const tt = document.getElementById('graphTooltip');
    if (!tt) return;
    tt.style.left = `${ev.clientX + 14}px`;
    tt.style.top  = `${ev.clientY - 36}px`;
  },
};

export default Graph;
