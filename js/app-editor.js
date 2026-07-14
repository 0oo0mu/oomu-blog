/**
 * js/app-editor.js — 에디터 페이지 진입점
 */

import Theme  from './core/theme.js';
import Accent from './core/accent.js';
import Editor     from './modules/editor.js';
import EditorAuth from './modules/editor-auth.js';

Theme.init();
Accent.init();
Editor.init();
EditorAuth.init();   // 에디터 진입 잠금(비번) + GitHub 토큰 보관
