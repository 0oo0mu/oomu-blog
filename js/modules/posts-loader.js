/**
 * js/modules/posts-loader.js — 포스트 데이터 로더
 *
 * posts/posts.json을 fetch로 가져와서 파싱하고,
 * 날짜 순으로 정렬한 뒤 App 이벤트로 알려줍니다.
 *
 * 발행하는 이벤트:
 *   'posts:loaded' → { posts: Post[] }
 *   'posts:error'  → { error: Error }
 *
 * Post 객체 구조:
 *   {
 *     file:     string,   // 파일 경로 (예: "개발/js/hello.md")
 *     title:    string,
 *     date:     string,   // "YYYY-MM-DD"
 *     category: string,   // 폴더 계층 (예: "개발/js")
 *     tags:     string[],
 *     excerpt:  string,
 *   }
 */

import App from '../core/app.js';

/** 캐시: 한 번 불러온 포스트는 재요청하지 않음 */
let _cache = null;
/** 캐시: 폴더 기반 카테고리 목록(빈 폴더 포함) */
let _catCache = null;

const PostsLoader = {
  /**
   * posts/posts.json을 불러오고 'posts:loaded' 이벤트를 발행합니다.
   * 이미 로드된 경우 캐시된 데이터를 그대로 씁니다.
   *
   * @returns {Promise<Post[]>} 정렬된 포스트 배열
   */
  async load() {
    // 캐시 있으면 재사용
    if (_cache) {
      App.emit('posts:loaded', { posts: _cache, categories: _catCache || [] });
      return _cache;
    }

    try {
      const res = await fetch('posts/posts.json');
      if (!res.ok) throw new Error(`posts.json 불러오기 실패: HTTP ${res.status}`);

      const posts = await res.json();

      // 날짜 내림차순 정렬 (최신 글이 먼저)
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));

      // 폴더 기반 카테고리 목록(빈 폴더 포함) — 없으면 빈 배열로 폴백
      let categories = [];
      try {
        const cres = await fetch('posts/categories.json');
        if (cres.ok) categories = await cres.json();
      } catch (_) { /* categories.json 없어도 정상 동작 */ }

      _cache = posts;
      _catCache = categories;
      App.emit('posts:loaded', { posts, categories });
      return posts;

    } catch (error) {
      console.error('[PostsLoader]', error);
      App.emit('posts:error', { error });
      throw error;
    }
  },

  /**
   * 캐시를 초기화합니다.
   * build.js로 posts.json을 재생성한 뒤 새로고침 없이
   * 목록을 다시 불러올 때 사용합니다. (현재는 예비용)
   */
  clearCache() {
    _cache = null;
  },
};

export default PostsLoader;
