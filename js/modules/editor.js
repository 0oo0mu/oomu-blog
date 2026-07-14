/**
 * js/modules/editor.js — 마크다운 글 작성 에디터
 *
 * 기능:
 *   - Front Matter 폼 (제목, 날짜, 카테고리, 태그, 요약)
 *   - 마크다운 textarea 에디터
 *   - 실시간 미리보기 (marked.js 사용)
 *   - 서식 버튼 (볼드, 이탤릭, 코드, 링크, 제목 등)
 *   - File System Access API로 파일 직접 저장
 *   - 저장 후 build.js 실행 안내 토스트
 *   - 탭 키 들여쓰기 지원
 */

import Markdown    from './markdown.js';
import PostEnhance from './post-enhance.js';

const Editor = {
  /** 현재 열려있는 파일 핸들 (File System Access API, 로컬 전용) */
  _fileHandle: null,

  /**
   * 에디터를 초기화합니다.
   * DOM이 준비된 후 호출해야 합니다.
   */
  async init() {
    this._bindFormPreview();   // Front Matter 변경 → 미리보기 업데이트
    await this._bindCategoryDropdown(); // 카테고리 드롭다운 (posts.json 연동)
    this._bindTextarea();      // 본문 입력 → 미리보기 업데이트
    this._bindFormatBtns();    // 서식 버튼 클릭
    this._bindSaveBtn();       // 로컬 저장 버튼
    this._bindPublishBtn();    // GitHub 게시 버튼
    this._bindDeleteBtn();     // GitHub 삭제 버튼(수정 중일 때만)
    this._bindNewBtn();        // 새 글 버튼
    this._bindGitHubSettings();// GitHub 설정 패널
    this._setDefaultDate();    // 날짜 기본값: 오늘
    this._updatePreview();     // 초기 미리보기
    this._applyGitHubSettingsToUI(); // 저장된 설정 복원
    await this._loadEditParam();     // ?edit=경로 있으면 기존 글 불러오기(수정)
  },

  // ══════════════════════════════════════════════════════
  // [1] Front Matter 폼
  // ══════════════════════════════════════════════════════

  /**
   * Front Matter 폼의 모든 입력 필드가 바뀔 때마다 미리보기를 업데이트합니다.
   */
  _bindFormPreview() {
    const fields = ['fmTitle', 'fmDate', 'fmCategory', 'fmTags', 'fmExcerpt'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this._updatePreview());
    });
  },

  // ══════════════════════════════════════════════════════
  // [1-2] 카테고리 드롭다운 (posts.json 연동)
  // ══════════════════════════════════════════════════════

  /**
   * 카테고리 드롭다운을 posts.json의 실제 카테고리로 채우고,
   * 선택 값을 실제 저장에 쓰이는 #fmCategory input에 반영합니다.
   *
   * 옵션 구성:
   *   ''        → (파일 경로에서 자동) — 비워두면 build.js가 폴더 경로로 채움
   *   각 카테고리 → posts.json에서 뽑은 실제 카테고리들
   *   '__new__' → + 새 카테고리 직접 입력 → 텍스트 입력칸 노출
   *
   * posts.json fetch 실패(file://로 열었을 때 등) 시:
   *   드롭다운은 기본 옵션만 두고, 직접 입력 input을 항상 쓸 수 있게 폴백.
   */
  async _bindCategoryDropdown() {
    const select   = document.getElementById('fmCategorySelect');
    const textInput = document.getElementById('fmCategory');
    if (!select || !textInput) return;

    const NEW = '__new__';

    // 드롭다운 변경 → 실제 값(#fmCategory) 세팅
    select.addEventListener('change', () => {
      if (select.value === NEW) {
        // 직접 입력 모드: 텍스트칸 노출 + 값 비우고 포커스
        textInput.style.display = '';
        textInput.value = '';
        textInput.focus();
      } else {
        // 기존 카테고리(또는 자동) 선택: 텍스트칸 숨기고 값 반영
        textInput.style.display = 'none';
        textInput.value = select.value; // '' 이면 build.js가 폴더로 자동 분류
      }
      this._updatePreview();
    });

    // 카테고리 목록 로드
    let categories = [];
    try {
      const res  = await fetch('posts/posts.json', { cache: 'no-store' });
      const data = await res.json();
      categories = [...new Set(data.map(p => p.category).filter(Boolean))].sort();
    } catch (err) {
      // file://로 열면 fetch가 막힘 → 직접 입력만으로 폴백
      console.warn('[Editor] posts.json 로드 실패, 직접 입력만 사용:', err.message);
    }

    const opts = [
      `<option value="">(파일 경로에서 자동)</option>`,
      ...categories.map(c => `<option value="${c}">${c}</option>`),
      `<option value="${NEW}">+ 새 카테고리 직접 입력</option>`,
    ];
    select.innerHTML = opts.join('');
    textInput.style.display = 'none'; // 시작은 드롭다운 모드
  },

  /**
   * URL에 ?edit=경로 가 있으면 기존 글을 불러와 폼에 채웁니다. (게시글 수정)
   * 파일명 칸에 원래 경로가 채워지므로, 게시하면 GitHub의 같은 파일을 덮어씁니다.
   */
  async _loadEditParam() {
    const params = new URLSearchParams(location.search);
    const file = params.get('edit') || params.get('file');
    if (!file) return;
    try {
      const res = await fetch('posts/' + file, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { meta, content } = Markdown.parseFrontMatter(await res.text());

      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('fmTitle',        meta.title   || '');
      set('fmDate',         meta.date    || '');
      set('fmTags',         (meta.tags   || []).join(', '));
      set('fmExcerpt',      meta.excerpt || '');
      set('editorTextarea', content.replace(/^\n+/, ''));
      set('filenameInput',  file);   // 같은 파일 덮어쓰기

      // 카테고리: 드롭다운에 있으면 선택, 없으면 직접입력으로 표시
      const catSel = document.getElementById('fmCategorySelect');
      const catInput = document.getElementById('fmCategory');
      if (catInput) catInput.value = meta.category || '';
      if (catSel) {
        catSel.value = meta.category || '';
        if (catSel.value !== (meta.category || '')) {
          if ([...catSel.options].some(o => o.value === '__new__')) catSel.value = '__new__';
          if (catInput) catInput.style.display = '';
        } else if (catInput) {
          catInput.style.display = 'none';
        }
      }

      const pub = document.getElementById('publishBtn');
      if (pub) pub.innerHTML = '🚀 수정 게시';
      const del = document.getElementById('deleteBtn');
      if (del) del.style.display = '';   // 수정 모드에서만 삭제 버튼 표시

      this._updatePreview();
      showToast('✏️ 기존 글 불러옴: ' + file);
    } catch (e) {
      console.error('[Editor] 수정 불러오기 실패:', e);
      showToast('불러오기 실패: ' + e.message);
    }
  },

  /**
   * 오늘 날짜를 'YYYY-MM-DD' 형식으로 날짜 입력 필드에 설정합니다.
   */
  _setDefaultDate() {
    const dateEl = document.getElementById('fmDate');
    if (dateEl && !dateEl.value) {
      const today = new Date().toISOString().slice(0, 10);
      dateEl.value = today;
    }
  },

  /**
   * 폼에서 현재 입력된 Front Matter 값을 객체로 반환합니다.
   * @returns {{ title, date, category, tags, excerpt }}
   */
  _getFormValues() {
    return {
      title:    document.getElementById('fmTitle')?.value.trim()    || '',
      date:     document.getElementById('fmDate')?.value.trim()     || '',
      category: document.getElementById('fmCategory')?.value.trim() || '',
      tags:     document.getElementById('fmTags')?.value.trim()     || '',
      excerpt:  document.getElementById('fmExcerpt')?.value.trim()  || '',
    };
  },

  // ══════════════════════════════════════════════════════
  // [2] 실시간 미리보기
  // ══════════════════════════════════════════════════════

  /**
   * textarea 입력에 미리보기를 연결합니다.
   * 타이핑할 때마다 150ms 디바운스 후 미리보기 업데이트
   * (디바운스: 연속 입력 중엔 기다렸다가 멈추면 한 번만 실행)
   */
  _bindTextarea() {
    const ta = document.getElementById('editorTextarea');
    if (!ta) return;

    let timer = null;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this._updatePreview(), 150);
    });
  },

  /**
   * 미리보기 패널을 현재 폼 + 본문 내용으로 업데이트합니다.
   */
  _updatePreview() {
    const meta    = this._getFormValues();
    const content = document.getElementById('editorTextarea')?.value || '';

    // 미리보기 헤더 (제목, 날짜, 카테고리, 태그)
    const headerEl = document.getElementById('previewHeader');
    if (headerEl) {
      const tagsHtml = meta.tags
        ? meta.tags.split(',').map(t => `<span class="post-tag">#${t.trim()}</span>`).join('')
        : '';

      headerEl.innerHTML = `
        ${meta.category ? `<span class="post-category">${meta.category}</span>` : ''}
        <h1>${meta.title || '<span style="color:var(--text-muted)">제목을 입력하세요</span>'}</h1>
        <div class="post-card-meta">
          <span class="post-date">${meta.date ? formatDate(meta.date) : ''}</span>
          <div class="post-tags">${tagsHtml}</div>
        </div>
      `;
    }

    // 미리보기 본문
    const bodyEl = document.getElementById('previewBody');
    if (bodyEl) {
      if (content.trim()) {
        bodyEl.innerHTML = Markdown.parse(content);
        // 코드 하이라이팅 + 헤더 토글을 미리보기에도 적용
        PostEnhance.apply(bodyEl);
      } else {
        bodyEl.innerHTML = `
          <div class="preview-empty">
            <div class="icon">✏️</div>
            <p>왼쪽에서 마크다운을 입력하면<br>여기에 미리보기가 표시됩니다.</p>
          </div>`;
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // [3] 서식 버튼 (볼드, 이탤릭, 링크 등)
  // ══════════════════════════════════════════════════════

  /**
   * 서식 버튼들의 클릭 이벤트를 연결합니다.
   * data-format 속성으로 어떤 서식을 적용할지 결정합니다.
   */
  _bindFormatBtns() {
    const bar = document.getElementById('formatBar');
    if (!bar) return;

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.fmt-btn');
      if (!btn) return;
      const format = btn.dataset.format;
      this._applyFormat(format);
    });
  },

  /**
   * textarea에서 선택된 텍스트에 마크다운 서식을 적용합니다.
   * 선택 영역이 없으면 플레이스홀더 텍스트를 삽입합니다.
   *
   * @param {string} format - 서식 종류 ('bold', 'italic', 'code', 등)
   */
  _applyFormat(format) {
    const ta    = document.getElementById('editorTextarea');
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.slice(start, end); // 선택된 텍스트

    // 서식별 변환 규칙: [앞에 붙을 것, 뒤에 붙을 것, 기본 텍스트]
    const rules = {
      bold:       ['**',  '**',  '굵게'],
      italic:     ['*',   '*',   '기울임'],
      strike:     ['~~',  '~~',  '취소선'],
      code:       ['`',   '`',   '코드'],
      codeblock:  ['```\n', '\n```', '코드 블록'],
      link:       ['[',   '](URL)', '링크 텍스트'],
      image:      ['![',  '](URL)', '이미지 설명'],
      h2:         ['## ', '',    '제목 2'],
      h3:         ['### ','',    '제목 3'],
      quote:      ['> ',  '',    '인용문'],
      hr:         ['\n---\n', '', ''],
      ul:         ['- ',  '',    '목록 항목'],
      ol:         ['1. ', '',    '목록 항목'],
    };

    const rule = rules[format];
    if (!rule) return;

    const [before, after, placeholder] = rule;
    const text = sel || placeholder; // 선택된 게 없으면 기본 텍스트 사용

    // textarea 값 교체 (execCommand는 deprecated, 직접 문자열 조작)
    const newVal =
      ta.value.slice(0, start) +
      before + text + after +
      ta.value.slice(end);

    ta.value = newVal;

    // 커서 위치: 삽입된 텍스트 끝으로 이동
    const newPos = start + before.length + text.length + after.length;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();

    this._updatePreview();
  },

  // ══════════════════════════════════════════════════════
  // [4] GitHub 게시
  // ══════════════════════════════════════════════════════

  /** GitHub 설정을 localStorage에서 가져옵니다. */
  _getGitHubSettings() {
    return {
      // 토큰은 잠금 해제된 세션(EditorAuth)에서 가져옵니다. (평문 저장 안 함)
      token:  (window.EditorAuth && window.EditorAuth.getToken()) || localStorage.getItem('gh_token') || '',
      owner:  localStorage.getItem('gh_owner')  || '0oo0mu',
      repo:   localStorage.getItem('gh_repo')   || 'oomu-blog',
      branch: localStorage.getItem('gh_branch') || 'main',
    };
  },

  /** GitHub 설정 패널의 현재 값을 localStorage에 저장합니다. */
  _saveGitHubSettings() {
    const fields = ['gh_token', 'gh_owner', 'gh_repo', 'gh_branch'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) localStorage.setItem(id, el.value.trim());
    });
    showToast('✅ GitHub 설정 저장됨');
    document.getElementById('ghSettingsPanel').classList.remove('open');
  },

  /** 저장된 설정 값을 설정 패널 폼에 채웁니다. */
  _applyGitHubSettingsToUI() {
    const s = this._getGitHubSettings();
    const map = { gh_token: s.token, gh_owner: s.owner, gh_repo: s.repo, gh_branch: s.branch };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
  },

  /** GitHub 설정 버튼·패널 이벤트 연결 */
  _bindGitHubSettings() {
    document.getElementById('ghSettingsBtn')
      ?.addEventListener('click', () => {
        document.getElementById('ghSettingsPanel').classList.toggle('open');
      });

    document.getElementById('ghSaveSettingsBtn')
      ?.addEventListener('click', () => this._saveGitHubSettings());

    // 설정 패널 바깥 클릭 시 닫기
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('ghSettingsPanel');
      const btn   = document.getElementById('ghSettingsBtn');
      if (panel?.classList.contains('open') &&
          !panel.contains(e.target) &&
          !btn?.contains(e.target)) {
        panel.classList.remove('open');
      }
    });
  },

  /** 게시 버튼 클릭 이벤트 연결 */
  _bindPublishBtn() {
    document.getElementById('publishBtn')
      ?.addEventListener('click', () => this._publishToGitHub());
  },

  /**
   * 게시할 파일 경로(posts/ 기준 상대경로)를 결정합니다.
   *   - 파일명 칸에 직접 넣었으면 그 값을 사용(고급/override)
   *   - 비어 있으면 "카테고리/제목-슬러그.md" 로 자동 생성
   *     → 폴더가 항상 카테고리와 일치하므로 어긋남이 생기지 않습니다.
   */
  _resolveRelPath() {
    const manual = document.getElementById('filenameInput')?.value.trim();
    if (manual) return manual.endsWith('.md') ? manual : manual + '.md';

    const { category, title } = this._getFormValues();
    const slug = (title || '새-글')
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
    return (category ? category + '/' : '') + slug + '.md';
  },

  /**
   * GitHub API를 통해 글을 저장소에 직접 커밋합니다.
   *
   * 흐름:
   *   1. 설정(토큰·저장소) 확인
   *   2. 파일 경로 확인
   *   3. 기존 파일이 있으면 SHA 조회 (업데이트 시 필요)
   *   4. PUT /repos/{owner}/{repo}/contents/{path} 로 파일 생성/수정
   *   5. GitHub Actions가 자동으로 빌드·배포
   */
  async _publishToGitHub() {
    const { token, owner, repo, branch } = this._getGitHubSettings();

    // ── 설정 검증 ──
    if (!token || !owner || !repo) {
      showToast('⚙️ 먼저 GitHub 설정을 입력하세요 (⚙️ 버튼)');
      document.getElementById('ghSettingsPanel')?.classList.add('open');
      return;
    }

    const relPath = this._resolveRelPath();
    if (!relPath || relPath === '.md' || relPath === '새-글.md') {
      showToast('📝 제목을 입력하거나(자동 경로) 파일 경로를 지정하세요');
      document.getElementById('fmTitle')?.focus();
      return;
    }

    const filePath = `posts/${relPath}`;
    const content  = this._buildFileContent();
    const title    = document.getElementById('fmTitle')?.value.trim() || '새 글';

    // 버튼 로딩 상태
    const btn = document.getElementById('publishBtn');
    const origText = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 게시 중...'; }

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

      // ── 기존 파일 SHA 조회 (파일 업데이트 시 sha가 필요) ──
      let sha = null;
      try {
        const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });
        if (getRes.ok) {
          const data = await getRes.json();
          sha = data.sha;
        }
      } catch { /* 파일 없음 → 신규 생성 */ }

      // ── 파일 커밋 ──
      const body = {
        message: sha ? `글 수정: ${title}` : `새 글: ${title}`,
        content: btoa(unescape(encodeURIComponent(content))), // UTF-8 → Base64
        branch,
      };
      if (sha) body.sha = sha; // 기존 파일 업데이트 시 필수

      const putRes = await fetch(apiBase, {
        method:  'PUT',
        headers,
        body:    JSON.stringify(body),
      });

      if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || `HTTP ${putRes.status}`);
      }

      const action = sha ? '수정' : '게시';
      showToast(`🚀 ${action} 완료! GitHub Actions가 1~2분 내 배포합니다.`, 5000);

    } catch (err) {
      console.error('[Editor] GitHub 게시 실패:', err);
      if (err.message.includes('Bad credentials')) {
        showToast('❌ 토큰이 잘못되었습니다. GitHub 설정을 확인하세요.');
      } else if (err.message.includes('Not Found')) {
        showToast('❌ 저장소를 찾을 수 없습니다. owner/repo를 확인하세요.');
      } else {
        showToast('❌ 게시 실패: ' + err.message);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
    }
  },

  /** 삭제 버튼 클릭 이벤트 연결 */
  _bindDeleteBtn() {
    document.getElementById('deleteBtn')
      ?.addEventListener('click', () => this._deleteFromGitHub());
  },

  /**
   * GitHub API로 현재 불러온 글 파일을 저장소에서 삭제합니다.
   *   1. 파일 경로 확인(수정으로 불러온 글만 대상)
   *   2. 파일 SHA 조회
   *   3. DELETE /repos/{owner}/{repo}/contents/{path}
   *   4. GitHub Actions가 자동 재배포 → 목록으로 이동
   */
  async _deleteFromGitHub() {
    const { token, owner, repo, branch } = this._getGitHubSettings();
    if (!token || !owner || !repo) {
      showToast('⚙️ 먼저 GitHub 설정을 입력하세요 (⚙️ 버튼)');
      document.getElementById('ghSettingsPanel')?.classList.add('open');
      return;
    }

    const manual = document.getElementById('filenameInput')?.value.trim();
    if (!manual) {
      showToast('🗑️ 삭제할 글이 없습니다. (수정으로 불러온 글만 삭제 가능)');
      return;
    }
    const relPath  = manual.endsWith('.md') ? manual : manual + '.md';
    const filePath = `posts/${relPath}`;

    if (!confirm(`정말 삭제할까요?\n\n${filePath}\n\n(되돌리려면 git 기록에서 복구해야 합니다)`)) return;

    const btn = document.getElementById('deleteBtn');
    const origText = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 삭제 중...'; }

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

      // 파일 SHA 조회 (삭제에 필수)
      const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });
      if (getRes.status === 404) { showToast('❌ 저장소에 그 파일이 없습니다.'); return; }
      if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
      const { sha } = await getRes.json();

      // 삭제
      const delRes = await fetch(apiBase, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ message: `글 삭제: ${relPath}`, sha, branch }),
      });
      if (!delRes.ok) {
        const e = await delRes.json();
        throw new Error(e.message || `HTTP ${delRes.status}`);
      }

      showToast('🗑️ 삭제 완료! 1~2분 내 반영됩니다. 목록으로 이동합니다.', 4000);
      setTimeout(() => { window.location.href = 'index.html'; }, 1500);

    } catch (err) {
      console.error('[Editor] 삭제 실패:', err);
      if (err.message.includes('Bad credentials')) {
        showToast('❌ 토큰이 잘못되었습니다.');
      } else {
        showToast('❌ 삭제 실패: ' + err.message);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
    }
  },

  // ══════════════════════════════════════════════════════
  // [5] 로컬 파일 저장 (File System Access API)
  // ══════════════════════════════════════════════════════

  /**
   * 저장 버튼 클릭 이벤트를 연결합니다.
   */
  _bindSaveBtn() {
    const btn = document.getElementById('saveBtn');
    if (btn) btn.addEventListener('click', () => this.save());
  },

  /**
   * 새 글 버튼 클릭 시 폼과 에디터를 초기화합니다.
   */
  _bindNewBtn() {
    const btn = document.getElementById('newBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (confirm('현재 작성 중인 내용이 사라집니다. 새로 시작할까요?')) {
        this._fileHandle = null;
        document.getElementById('fmTitle').value    = '';
        document.getElementById('fmDate').value     = new Date().toISOString().slice(0, 10);
        document.getElementById('fmCategory').value = '';
        // 카테고리 드롭다운도 '자동'으로 되돌리고 직접입력칸 숨김
        const catSel = document.getElementById('fmCategorySelect');
        if (catSel) catSel.value = '';
        document.getElementById('fmCategory').style.display = 'none';
        document.getElementById('fmTags').value     = '';
        document.getElementById('fmExcerpt').value  = '';
        document.getElementById('editorTextarea').value = '';
        document.getElementById('filenameInput').value  = '';
        this._updatePreview();
      }
    });
  },

  /**
   * .md 파일 내용을 생성합니다.
   * Front Matter + 본문을 합쳐서 반환합니다.
   *
   * @returns {string} .md 파일 전체 텍스트
   */
  _buildFileContent() {
    const { title, date, category, tags, excerpt } = this._getFormValues();
    const body = document.getElementById('editorTextarea')?.value || '';

    // 태그: "JS, CSS" → [JS, CSS] 형식으로 변환
    const tagsFormatted = tags
      ? '[' + tags.split(',').map(t => t.trim()).filter(Boolean).join(', ') + ']'
      : '[]';

    const frontMatter = [
      '---',
      `title: ${title}`,
      `date: ${date}`,
      category ? `category: ${category}` : null,
      `tags: ${tagsFormatted}`,
      excerpt ? `excerpt: ${excerpt}` : null,
      '---',
    ].filter(Boolean).join('\n'); // null 제거 후 합침

    return frontMatter + '\n\n' + body;
  },

  /**
   * File System Access API를 사용해서 파일을 저장합니다.
   *
   * 동작:
   *   - 처음 저장: 파일 선택 창 열림 → posts/ 폴더에 저장
   *   - 이후 저장: 같은 파일에 덮어씀 (창 안 열림)
   *
   * 브라우저 미지원 시: 자동으로 다운로드로 폴백합니다.
   */
  async save() {
    const content  = this._buildFileContent();
    const filename = this._getSuggestedFilename();

    // 브라우저 구분 없이 항상 다운로드 폴더로 저장합니다.
    // (Chrome/Edge의 "다른 이름으로 저장" 창을 쓰지 않고 바로 다운로드)
    this._downloadFile(content, filename);
  },

  /**
   * 제목으로부터 파일명을 생성합니다.
   * 한글/영문/숫자만 남기고, 공백은 하이픈으로 변환합니다.
   *
   * @returns {string} 예: '나의-첫-글.md'
   */
  _getSuggestedFilename() {
    const filenameInput = document.getElementById('filenameInput')?.value.trim();
    if (filenameInput) {
      return filenameInput.endsWith('.md') ? filenameInput : filenameInput + '.md';
    }

    const title = document.getElementById('fmTitle')?.value.trim() || '새-글';
    return title
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50) + '.md';
  },

  /**
   * File System Access API 미지원 시 다운로드로 폴백합니다.
   * @param {string} content  - 파일 내용
   * @param {string} filename - 파일명
   */
  _downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this._showSaveSuccess(true); // 다운로드 안내 포함
  },

  // ══════════════════════════════════════════════════════
  // [5] 저장 성공 토스트 알림
  // ══════════════════════════════════════════════════════

  /**
   * 저장 완료 토스트 메시지를 표시합니다.
   * @param {boolean} isDownload - true면 다운로드 폴백 메시지 표시
   */
  _showSaveSuccess(isDownload = false) {
    // 저장 버튼을 일시적으로 초록색으로 변경
    const btn = document.getElementById('saveBtn');
    if (btn) {
      btn.classList.add('saved');
      btn.textContent = '✅ 저장됨';
      setTimeout(() => {
        btn.classList.remove('saved');
        btn.innerHTML = '💾 저장';
      }, 2000);
    }

    // 토스트 표시
    const msg = isDownload
      ? '📥 다운로드됨 — posts/ 폴더에 옮긴 후 node build.js 실행하세요'
      : '✅ 저장 완료 — node build.js 를 실행해서 목록을 업데이트하세요';

    showToast(msg);
  },
};

/**
 * 날짜 문자열을 한국어 형식으로 변환합니다.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * 화면 하단에 토스트 메시지를 잠깐 표시합니다.
 * @param {string} message - 표시할 텍스트
 * @param {number} duration - 표시 시간 ms (기본: 4000)
 */
function showToast(message, duration = 4000) {
  // 기존 토스트 제거
  document.querySelector('.toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // 다음 프레임에 show 클래스 추가 → CSS transition 발동
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  // duration 후 내려가며 사라짐
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export default Editor;
