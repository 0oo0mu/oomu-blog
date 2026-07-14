/**
 * js/modules/editor-auth.js — 에디터 진입 잠금 + GitHub 토큰 보관
 *
 * 목적:
 *   에디터(editor.html)에 들어올 때 "내가 정한 비밀번호"로 잠금을 풀어야 하고,
 *   실제 GitHub 토큰(PAT)은 그 비밀번호로 암호화되어 브라우저(localStorage)에만 보관됩니다.
 *
 * 동작 요약:
 *   - 최초 1회: GitHub 토큰 + 내가 정한 비밀번호 입력 → 토큰을 비번으로 암호화해 저장
 *   - 이후: 비밀번호만 입력하면 복호화되어 세션이 열림 (토큰은 다시 볼 일 없음)
 *   - 세션은 10분 유지되며, 입력·활동·[연장] 버튼이 있으면 자동으로 시간 연장(슬라이딩)
 *   - 10분간 활동이 없으면 다시 잠금
 *
 * 보안 메모:
 *   토큰은 비번으로 AES-GCM 암호화(Web Crypto)되어 저장됩니다. 비번은 저장되지 않습니다.
 *   정적 사이트라 서버가 없으므로, 이 브라우저 안에서만 유효합니다(다른 PC에선 최초 설정 1회 필요).
 */

const SESSION_MIN = 10;                 // 세션 유지(분)
const LS_ENC   = 'gh_token_enc';        // localStorage: 암호화된 토큰
const SS_SESS  = 'editor_session';      // sessionStorage: { token, until }

// ── base64 헬퍼 (작은 데이터라 단순 방식으로 충분) ──
const b64   = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s)  => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const EditorAuth = {
  _tickTimer: null,

  // ══════════════════════════════════════════════
  // 암호화 (Web Crypto: PBKDF2 → AES-GCM)
  // ══════════════════════════════════════════════
  async _deriveKey(password, salt) {
    const base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },

  async _encrypt(token, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await this._deriveKey(password, salt);
    const ct   = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(token)
    );
    localStorage.setItem(LS_ENC, JSON.stringify({
      salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)),
    }));
  },

  async _decrypt(password) {
    const raw = localStorage.getItem(LS_ENC);
    if (!raw) return null;
    const { salt, iv, ct } = JSON.parse(raw);
    const key = await this._deriveKey(password, unb64(salt));
    const pt  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct)
    ); // 비번 틀리면 여기서 예외 발생
    return new TextDecoder().decode(pt);
  },

  hasToken() { return !!localStorage.getItem(LS_ENC); },

  reset() { localStorage.removeItem(LS_ENC); this.lock(); },

  // ══════════════════════════════════════════════
  // 세션 (sessionStorage, 슬라이딩 만료)
  // ══════════════════════════════════════════════
  _saveSession(token) {
    sessionStorage.setItem(SS_SESS, JSON.stringify({
      token, until: Date.now() + SESSION_MIN * 60 * 1000,
    }));
  },
  _session() {
    const raw = sessionStorage.getItem(SS_SESS);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() > s.until) { sessionStorage.removeItem(SS_SESS); return null; }
    return s;
  },
  getToken()   { return this._session()?.token || null; },
  isUnlocked() { return !!this._session(); },
  remainingMs() { const s = this._session(); return s ? s.until - Date.now() : 0; },
  lock() { sessionStorage.removeItem(SS_SESS); },

  /** 활동 시 세션 시간 연장 (슬라이딩) */
  extend() {
    const s = this._session();
    if (s) this._saveSession(s.token);
  },

  // ══════════════════════════════════════════════
  // 잠금 해제 / 최초 설정
  // ══════════════════════════════════════════════
  /**
   * 입력값으로 잠금 해제. 두 가지 모두 허용:
   *   ① 내가 정한 비밀번호  → 저장된 토큰을 복호화
   *   ② GitHub 토큰 원문     → GitHub API로 즉시 검증 후 사용
   */
  async unlock(input) {
    const val = (input || '').trim();
    if (!val) throw new Error('입력이 비어 있습니다');

    // ① 비밀번호로 저장된 토큰 복호화 시도
    if (this.hasToken()) {
      try {
        const token = await this._decrypt(val);
        if (token) { this._saveSession(token); return token; }
      } catch (_) { /* 비번이 아님 → 아래에서 토큰인지 확인 */ }
    }

    // ② 입력이 토큰 원문인지 확인 (GitHub API로 검증)
    if (this._looksLikeToken(val) && await this._validateToken(val)) {
      this._saveSession(val);
      return val;
    }

    throw new Error('인증 실패');
  },

  /** GitHub 토큰 형태인지 대략 판별 */
  _looksLikeToken(v) {
    return /^(ghp_|github_pat_|gho_|ghs_|ghu_)/.test(v) || v.length >= 40;
  },

  /** 토큰이 실제 유효한지 GitHub API로 확인 */
  async _validateToken(token) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
      });
      return res.ok;
    } catch (_) { return false; }
  },

  async setup(token, password) {
    await this._encrypt(token, password);
    // 게시에 필요한 저장소 정보 기본값 세팅(비어있을 때만)
    if (!localStorage.getItem('gh_owner'))  localStorage.setItem('gh_owner', '0oo0mu');
    if (!localStorage.getItem('gh_repo'))   localStorage.setItem('gh_repo', 'oomu-blog');
    if (!localStorage.getItem('gh_branch')) localStorage.setItem('gh_branch', 'main');
    this._saveSession(token);
  },

  // ══════════════════════════════════════════════
  // 초기화: 잠금화면·세션바 주입 + 게이트
  // ══════════════════════════════════════════════
  init() {
    if (!window.crypto?.subtle) {
      alert('이 브라우저/환경에서는 보안 저장(Web Crypto)이 지원되지 않습니다.\nhttps 또는 localhost에서 에디터를 열어주세요.');
      return;
    }
    this._injectOverlay();
    this._injectSessionBar();
    this._bindActivity();
    this._gate();
    // 1초마다 남은 시간 표시 갱신 + 만료 시 잠금
    this._tickTimer = setInterval(() => this._tick(), 1000);
  },

  _gate() {
    if (this.isUnlocked()) this._reveal();
    else this._showOverlay();
  },

  _tick() {
    const bar = document.getElementById('authSessionBar');
    if (this.isUnlocked()) {
      const ms = this.remainingMs();
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const t = document.getElementById('authRemain');
      if (t) t.textContent = `${m}:${String(s).padStart(2, '0')}`;
      if (bar) bar.style.display = 'flex';
    } else {
      if (bar) bar.style.display = 'none';
      // 방금 만료됐다면 잠금화면 다시 표시
      if (document.getElementById('authOverlay')?.style.display === 'none') {
        this._showOverlay();
      }
    }
  },

  /** 입력/클릭 등 활동이 있으면 세션 자동 연장 (300ms 스로틀) */
  _bindActivity() {
    let last = 0;
    const onAct = () => {
      if (!this.isUnlocked()) return;
      const now = Date.now();
      if (now - last > 300) { last = now; this.extend(); }
    };
    ['keydown', 'input', 'click', 'mousemove', 'touchstart'].forEach(ev =>
      document.addEventListener(ev, onAct, { passive: true })
    );
  },

  _reveal() {
    const ov = document.getElementById('authOverlay');
    if (ov) ov.style.display = 'none';
    this.extend();
  },

  _showOverlay() {
    const ov = document.getElementById('authOverlay');
    if (!ov) return;
    ov.style.display = 'flex';
    // 모드 전환: 토큰 있으면 잠금해제, 없으면 최초 설정
    const setup = !this.hasToken();
    ov.querySelector('#authSetup').style.display  = setup ? 'block' : 'none';
    ov.querySelector('#authUnlock').style.display = setup ? 'none'  : 'block';
    const focusEl = setup ? ov.querySelector('#authNewPw') : ov.querySelector('#authPw');
    setTimeout(() => focusEl?.focus(), 50);
  },

  _err(msg) {
    const e = document.getElementById('authError');
    if (e) { e.textContent = msg; e.style.display = msg ? 'block' : 'none'; }
  },

  // ── 잠금화면 DOM 주입 ──
  _injectOverlay() {
    if (document.getElementById('authOverlay')) return;
    const el = document.createElement('div');
    el.id = 'authOverlay';
    el.innerHTML = `
      <div class="auth-box">
        <div class="auth-title">🔒 에디터 잠금</div>

        <div id="authUnlock">
          <p class="auth-desc">비밀번호 또는 GitHub 토큰으로 잠금을 해제하세요.</p>
          <input type="password" id="authPw" class="auth-input" placeholder="비밀번호 또는 GitHub 토큰" autocomplete="off" />
          <button id="authUnlockBtn" class="auth-btn">잠금 해제</button>
          <button id="authResetBtn" class="auth-link">토큰 다시 설정</button>
        </div>

        <div id="authSetup" style="display:none">
          <p class="auth-desc">
            최초 1회 설정입니다. GitHub 토큰을 한 번 붙여넣고, 앞으로 쓸 비밀번호를 정하세요.
            토큰은 비밀번호로 암호화되어 이 브라우저에만 저장됩니다.
          </p>
          <input type="password" id="authToken" class="auth-input" placeholder="GitHub 토큰 (ghp_...)" autocomplete="off" />
          <input type="password" id="authNewPw" class="auth-input" placeholder="새 비밀번호 (내가 정함)" autocomplete="off" />
          <input type="password" id="authNewPw2" class="auth-input" placeholder="비밀번호 확인" autocomplete="off" />
          <button id="authSetupBtn" class="auth-btn">설정하고 잠금 해제</button>
          <a class="auth-link" href="https://github.com/settings/tokens/new?scopes=repo&description=Blog+Editor" target="_blank" rel="noopener">토큰 발급 방법 →</a>
        </div>

        <div id="authError" class="auth-error" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(el);

    // 잠금 해제
    const doUnlock = async () => {
      this._err('');
      const pw = document.getElementById('authPw').value;
      if (!pw) return;
      try {
        await this.unlock(pw);
        document.getElementById('authPw').value = '';
        this._reveal();
      } catch (_) {
        this._err('비밀번호 또는 토큰이 올바르지 않습니다.');
      }
    };
    el.querySelector('#authUnlockBtn').addEventListener('click', doUnlock);
    el.querySelector('#authPw').addEventListener('keydown', e => { if (e.key === 'Enter') doUnlock(); });

    // 최초 설정
    el.querySelector('#authSetupBtn').addEventListener('click', async () => {
      this._err('');
      const token = document.getElementById('authToken').value.trim();
      const pw    = document.getElementById('authNewPw').value;
      const pw2   = document.getElementById('authNewPw2').value;
      if (!token) return this._err('GitHub 토큰을 입력하세요.');
      if (pw.length < 4) return this._err('비밀번호는 4자 이상으로 정하세요.');
      if (pw !== pw2) return this._err('비밀번호 확인이 일치하지 않습니다.');
      try {
        await this.setup(token, pw);
        ['authToken', 'authNewPw', 'authNewPw2'].forEach(id => document.getElementById(id).value = '');
        this._reveal();
      } catch (e) {
        this._err('설정 실패: ' + e.message);
      }
    });

    // 토큰 다시 설정
    el.querySelector('#authResetBtn').addEventListener('click', () => {
      if (confirm('저장된 토큰을 지우고 다시 설정할까요?')) {
        this.reset();
        this._showOverlay();
      }
    });
  },

  // ── 세션바(남은시간 + 연장 + 잠금) 주입 ──
  _injectSessionBar() {
    if (document.getElementById('authSessionBar')) return;
    const bar = document.createElement('div');
    bar.id = 'authSessionBar';
    bar.style.display = 'none';
    bar.innerHTML = `
      <span class="auth-remain-wrap">🔓 <span id="authRemain">10:00</span></span>
      <button id="authRenewBtn" class="auth-mini-btn" title="세션 연장">연장</button>
      <button id="authLockBtn" class="auth-mini-btn" title="지금 잠그기">잠금</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('#authRenewBtn').addEventListener('click', () => this.extend());
    bar.querySelector('#authLockBtn').addEventListener('click', () => { this.lock(); this._showOverlay(); this._tick(); });
  },
};

window.EditorAuth = EditorAuth;
export default EditorAuth;
