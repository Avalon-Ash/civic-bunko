export interface PlatformEnv {
  matchMedia?: (query: string) => { matches: boolean };
  standalone?: boolean;
}

const STANDALONE_MEDIA_QUERY = '(display-mode: standalone)';

/** 判斷目前是否已以主畫面獨立 App 模式開啟（PWA standalone 或 iOS Safari standalone）。 */
export function isStandaloneApp(env?: PlatformEnv): boolean {
  if (env) {
    if (env.standalone === true) {
      return true;
    }
    return env.matchMedia?.(STANDALONE_MEDIA_QUERY).matches === true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const nav = window.navigator;
  if ('standalone' in nav && nav.standalone === true) {
    return true;
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(STANDALONE_MEDIA_QUERY).matches;
  }

  return false;
}
