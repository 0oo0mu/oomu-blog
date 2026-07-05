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
  _posts:       [],
  _currentFile: null,
  _isVisible:   false,
  _sim:         null,   // D3 전체 그래프 simulation
  _miniSim:     null,   // D3 미니 그래프 simulation
  _d3:          null,   // window.d3 참조

  // ─────────────────────────────────────────
  // [1] 초기화
  // ─────────────────────────────────────────

  init() {
    // 포스트 데이터 수신 → 미니 그래프 초기 렌더
    App.on('posts:loaded', ({ posts }) => {
      this._posts = posts;
      // D3 로드 후 미니 그래프 그리기
      this._loadD3().then(() => {
        this._d3 = window.d3;
        this._rebuildMini();
      });
    });

    // 현재 포스트 추적
    App.on('router:post', ({ file }) => {
      this._currentFile = file;
      if (this._isVisible) this._rebuild();
      this._rebuildMini();
    });

    App.on('router:list', () => {
      this._currentFile = null;
      if (this._isVisible) this._rebuild();
      this._rebuildMini();
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

    // 카테고리별 총 포스트 수 (자기 자신 + 모든 하위 카테고리 포함)
    // 예: '개발'은 '개발/코드해설'의 글까지 합산됨
    const catPostCount = {};
    catSet.forEach(cat => { catPostCount[cat] = 0; });
    posts.forEach(p => {
      if (!p.category) return;
      let cur = '';
      p.category.split('/').forEach(part => {
        cur = cur ? `${cur}/${part}` : part;
        if (catPostCount[cur] !== undefined) catPostCount[cur]++;
      });
    });

    catSet.forEach(cat => {
      const parts = cat.split('/');
      const depth = parts.length;            // 1 = 최상위 폴더
      const count = catPostCount[cat] || 0;  // 하위 포함 총 글 수

      // 크기 = 기본값 + 깊이 보너스(상위일수록 큼) + 글 수 보너스(많을수록 큼)
      // 전체적으로 차분하게: 보너스 폭을 줄이고 최대 크기를 제한합니다.
      const depthBonus = Math.max(0, 3 - depth) * 2;   // depth1:+4, depth2:+2, depth3+:+0
      const countBonus = Math.sqrt(count) * 1.4;
      const r = Math.min(20, Math.round(8 + depthBonus + countBonus));

      add({
        id: `cat:${cat}`,
        type: 'category',
        label: parts[parts.length - 1],
        r, depth, count,
        isCurrent: false,
      });
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
      const baseR     = isCurrent ? 14 : 7;

      add({ id: `post:${p.file}`, type: 'post', label: p.title || p.file, file: p.file, r: baseR, isCurrent });

      if (p.category && byId[`cat:${p.category}`]) {
        links.push({ source: `cat:${p.category}`, target: `post:${p.file}`, ltype: 'cat', dist: 55 });
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
      .attr('r', d => d.r + 5);

    // ── 카테고리 노드: 둥근 사각형 ──
    // 상위 폴더(depth가 작을수록)는 테두리도 더 굵게 그려서 위계를 한 번 더 강조합니다.
    nodeSel.filter(d => d.type === 'category')
      .append('rect')
      .attr('class', 'node-shape')
      .attr('width',  d => d.r * 1.9)
      .attr('height', d => d.r * 1.9)
      .attr('x', d => -d.r * 0.95)
      .attr('y', d => -d.r * 0.95)
      .attr('rx', 4)
      .style('stroke-width', d => `${Math.max(1.2, 2.6 - (d.depth - 1) * 0.5)}px`);

    // ── 포스트·태그 노드: 원 ──
    nodeSel.filter(d => d.type !== 'category')
      .append('circle')
      .attr('class', 'node-shape')
      .attr('r', d => d.r);

    // ── 라벨 ──
    // 카테고리는 깊이가 얕을수록(상위 폴더) 글자도 더 크게 표시해 위계를 강조합니다.
    nodeSel.append('text')
      .attr('class', 'node-label')
      .attr('dy', d => d.r + 13)
      .attr('text-anchor', 'middle')
      .style('font-size', d => {
        if (d.type !== 'category') return null;
        return `${Math.max(10, 13 - (d.depth - 1))}px`;
      })
      .style('font-weight', d => {
        if (d.type !== 'category') return null;
        return d.depth === 1 ? 700 : 600;
      })
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
        // 카테고리는 포함된 글 수를 함께 보여줍니다.
        tooltip.textContent = d.type === 'category'
          ? `${d.label} (${d.count}개)`
          : d.label;
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
          .distance(d => d.dist || 60)
          .strength(0.7)
      )
      .force('charge', d3.forceManyBody().strength(d => {
        // 카테고리는 크기(r)에 비례해서 더 강하게 밀어내, 큰 노드 주변에 자연스러운 여유 공간이 생깁니다.
        if (d.type === 'category') return -90 - d.r * 7;
        if (d.isCurrent)          return -160;
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

  // ─────────────────────────────────────────
  // [6] 미니 그래프 (사이드바 내장)
  // ─────────────────────────────────────────

  /**
   * 미니 그래프용 노드·링크 데이터를 빌드합니다.
   *
   * 포스트 뷰: 현재 게시글의 카테고리 경로 + 같은 카테고리 게시글만 표시
   * 목록 뷰: 모든 카테고리 + 모든 게시글
   */
  _buildMiniData() {
    const posts = this._posts;
    const nodes = [];
    const links = [];
    const byId  = {};
    const add   = n => { nodes.push(n); byId[n.id] = n; return n; };

    if (this._currentFile) {
      // ── 포스트 뷰: 현재 카테고리 계층 + 소속 포스트 ──
      const cur = posts.find(p => p.file === this._currentFile);
      const cat = cur?.category;
      if (!cat) return { nodes, links };

      // 카테고리 경로 계층 추가 (개발 → 개발/코드해설)
      const parts = cat.split('/');
      let pathSoFar = '';
      parts.forEach((part, i) => {
        const prev = pathSoFar;
        pathSoFar  = pathSoFar ? `${pathSoFar}/${part}` : part;
        const isLeaf = (i === parts.length - 1);
        add({ id: `cat:${pathSoFar}`, type: 'category', label: part,
              r: isLeaf ? 14 : 9, depth: i + 1, isCurrent: false });
        if (prev) links.push({ source: `cat:${prev}`, target: `cat:${pathSoFar}` });
      });

      // 해당 카테고리(하위 포함) 포스트
      posts
        .filter(p => p.category === cat || p.category?.startsWith(cat + '/'))
        .forEach(p => {
          const isCurrent = p.file === this._currentFile;
          add({ id: `post:${p.file}`, type: 'post',
                label: p.title || p.file, file: p.file,
                r: isCurrent ? 10 : 5, isCurrent });
          const linkTarget = byId[`cat:${p.category}`] ? `cat:${p.category}` : `cat:${cat}`;
          links.push({ source: linkTarget, target: `post:${p.file}` });
        });

    } else {
      // ── 목록 뷰: 카테고리 노드만 (포스트 제외 — 너무 많아서 뭉침) ──
      const catSet = new Set();
      const catPostCount = {};
      posts.forEach(p => {
        if (!p.category) return;
        p.category.split('/').reduce((acc, part) => {
          const full = acc ? `${acc}/${part}` : part;
          catSet.add(full);
          return full;
        }, '');
      });
      // 각 카테고리의 포스트 수 집계
      catSet.forEach(c => { catPostCount[c] = 0; });
      posts.forEach(p => {
        if (!p.category) return;
        let cur = '';
        p.category.split('/').forEach(part => {
          cur = cur ? `${cur}/${part}` : part;
          if (catPostCount[cur] !== undefined) catPostCount[cur]++;
        });
      });

      catSet.forEach(cat => {
        const parts = cat.split('/');
        const depth = parts.length;
        const count = catPostCount[cat] || 0;
        const r = Math.min(18, Math.round(8 + Math.max(0, 3 - depth) * 3 + Math.sqrt(count) * 1.5));
        add({ id: `cat:${cat}`, type: 'category',
              label: parts[parts.length - 1], r, depth, count, isCurrent: false });
      });
      // 부모→자식 링크
      catSet.forEach(cat => {
        const parts = cat.split('/');
        if (parts.length > 1) {
          const parent = parts.slice(0, -1).join('/');
          links.push({ source: `cat:${parent}`, target: `cat:${cat}` });
        }
      });
    }

    return { nodes, links };
  },

  /** 미니 그래프를 D3로 렌더링합니다. */
  _rebuildMini() {
    const d3    = this._d3 || window.d3;
    const svgEl = document.getElementById('miniGraphSvg');
    if (!d3 || !svgEl) return;

    if (this._miniSim) { this._miniSim.stop(); this._miniSim = null; }

    const w = svgEl.clientWidth  || 220;
    const h = svgEl.clientHeight || 185;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const { nodes, links } = this._buildMiniData();
    if (!nodes.length) return;

    // 링크 ID 해석
    const nodeById = {};
    nodes.forEach(n => { nodeById[n.id] = n; });
    const validLinks = links.filter(l => nodeById[l.source] && nodeById[l.target]);

    // 줌/패닝
    const g = svg.append('g');
    // 현재 줌/팬 변환을 저장 → 드래그 시 포인터 좌표를 시뮬레이션 좌표로 역변환하는 데 사용
    let miniTransform = d3.zoomIdentity;
    svg.call(
      d3.zoom()
        .scaleExtent([0.4, 4])
        .on('zoom', ev => { miniTransform = ev.transform; g.attr('transform', ev.transform); })
    );

    // 링크
    const linkSel = g.append('g')
      .selectAll('line')
      .data(validLinks)
      .join('line')
      .style('stroke', 'var(--border)')
      .style('stroke-width', '1px')
      .style('stroke-opacity', '0.7');

    // 노드 그룹
    const nodeSel = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', d => d.type === 'post' ? 'pointer' : 'default');

    // 카테고리 → 둥근 사각형 (style로 CSS 변수 적용)
    nodeSel.filter(d => d.type === 'category')
      .append('rect')
      .attr('rx', 3).attr('ry', 3)
      .attr('x',      d => -d.r)
      .attr('y',      d => -d.r * 0.65)
      .attr('width',  d => d.r * 2)
      .attr('height', d => d.r * 1.3)
      .style('fill',         'var(--accent)')
      .style('fill-opacity', '0.75')
      .style('stroke',       'var(--accent)')
      .style('stroke-width', d => `${Math.max(1, 2.2 - (d.depth - 1) * 0.4)}px`);

    // 카테고리 레이블
    nodeSel.filter(d => d.type === 'category')
      .append('text')
      .text(d => d.label.length > 5 ? d.label.slice(0, 5) + '…' : d.label)
      .attr('font-size', d => `${Math.max(7, 9 - (d.depth - 1))}px`)
      .style('fill', 'var(--bg)')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('pointer-events', 'none');

    // 게시글 → 원
    nodeSel.filter(d => d.type === 'post')
      .append('circle')
      .attr('r', d => d.r)
      .style('fill',         d => d.isCurrent ? 'var(--accent)' : 'var(--text-muted)')
      .style('fill-opacity', d => d.isCurrent ? '1' : '0.6')
      .style('stroke',       d => d.isCurrent ? '#fff' : 'none')
      .style('stroke-width', '1.5px');

    // 현재 게시글 레이블
    nodeSel.filter(d => d.isCurrent)
      .append('text')
      .text(d => d.label.length > 8 ? d.label.slice(0, 8) + '…' : d.label)
      .attr('font-size', '7px')
      .style('fill', 'var(--accent)')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.r + 9)
      .style('pointer-events', 'none');

    // 클릭 → 포스트 이동
    nodeSel.filter(d => d.type === 'post')
      .on('click', (ev, d) => { Router.goPost(d.file); });

    // 툴팁
    const tip = document.getElementById('miniGraphTooltip');
    nodeSel
      .on('mouseenter', (ev, d) => { if (tip) { tip.textContent = d.label; tip.style.opacity = '1'; } })
      .on('mouseleave', ()       => { if (tip) tip.style.opacity = '0'; });

    // 드래그
    // 포인터 좌표(svg 기준)를 현재 줌 변환의 역으로 풀어 시뮬레이션 좌표로 변환합니다.
    // → 확대/이동한 상태에서도 노드가 커서를 정확히 따라옵니다.
    nodeSel.call(
      d3.drag()
        .on('start', (ev, d) => {
          if (!ev.active) this._miniSim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag',  (ev, d) => {
          const [px, py] = miniTransform.invert(d3.pointer(ev, svgEl));
          d.fx = px; d.fy = py;
        })
        .on('end',   (ev, d) => {
          if (!ev.active) this._miniSim.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
    );

    // Force simulation — 좁은 공간(~220×185)에 맞춘 파라미터
    this._miniSim = d3.forceSimulation(nodes)
      .force('link',
        d3.forceLink(validLinks)
          .id(d => d.id)
          .distance(d => {
            const src = nodeById[typeof d.source === 'object' ? d.source.id : d.source];
            return src?.type === 'category' ? 55 : 38;
          })
          .strength(1)
      )
      .force('charge', d3.forceManyBody().strength(d =>
        d.type === 'category' ? -120 - d.r * 6 : -60
      ))
      .force('center',    d3.forceCenter(w / 2, h / 2).strength(0.3))
      .force('collision', d3.forceCollide(d => d.r + 6))
      .alphaDecay(0.025)
      .on('tick', () => {
        // ── 노드를 SVG 영역 안으로 가두기 ──
        // 중요: d.x/d.y 값 자체를 보정해야 링크(선)와 노드(상자)가 같은
        // 좌표를 공유합니다. (예전엔 노드만 transform에서 clamp하고 링크는
        // 원본 좌표를 써서 선이 상자에 닿지 않았음)
        // 벽에 닿으면 해당 축 속도(vx/vy)를 0으로 눌러 떨림도 줄입니다.
        nodes.forEach(d => {
          const nx = Math.max(d.r + 2, Math.min(w - d.r - 2, d.x ?? w / 2));
          const ny = Math.max(d.r + 2, Math.min(h - d.r - 2, d.y ?? h / 2));
          if (nx !== d.x) { d.x = nx; d.vx = 0; }
          if (ny !== d.y) { d.y = ny; d.vy = 0; }
        });

        linkSel
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
      });
  },
};

export default Graph;
