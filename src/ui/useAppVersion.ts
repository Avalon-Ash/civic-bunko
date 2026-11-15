import { useEffect, useRef, useState } from 'react';

const VERSION_CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** 讀取打包時注入的目前版本字串（非 Vite 環境回傳空字串）。 */
export function getCurrentAppVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
}

/** 從 version.json 回應物件擷取版本字串；格式不符時回傳 null。 */
export function parseRemoteVersion(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }
  if (!('version' in payload)) {
    return null;
  }
  const value = payload.version;
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 比對目前版本與遠端版本，不同時代表有新版本。 */
export function isNewerVersion(currentVersion: string, remoteVersion: string | null): boolean {
  if (!currentVersion || !remoteVersion) {
    return false;
  }
  return remoteVersion !== currentVersion;
}

/** 將版本 ISO 字串轉成當地時間顯示格式（YYYY/MM/DD HH:mm）。 */
export function formatAppVersion(isoVersion: string): string {
  if (!isoVersion) return '';
  const d = new Date(isoVersion);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export type UpdateCheckResult = 'new' | 'latest' | 'offline';

/** 使用者手動檢查更新：向線上要 version.json，並請 service worker 一起檢查。 */
export async function checkForUpdateNow(): Promise<UpdateCheckResult> {
  try {
    const response = await fetch('./version.json', { cache: 'no-store' });
    if (!response.ok) return 'offline';
    const payload: unknown = await response.json();
    const remoteVersion = parseRemoteVersion(payload);
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update().catch(() => undefined);
    }
    return isNewerVersion(getCurrentAppVersion(), remoteVersion) ? 'new' : 'latest';
  } catch {
    return 'offline';
  }
}

/** 正式環境中於前景切換與每 10 分鐘檢查 version.json，回傳是否有新版本。 */
export function useAppVersion(): boolean {
  const [hasUpdate, setHasUpdate] = useState(false);
  const foundRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return undefined;
    }
    if (typeof document === 'undefined' || typeof fetch !== 'function') {
      return undefined;
    }

    const currentVersion = getCurrentAppVersion();
    if (!currentVersion) {
      return undefined;
    }

    let active = true;

    const checkVersion = async () => {
      if (!active || foundRef.current) return;
      try {
        const response = await fetch('./version.json', { cache: 'no-store' });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        const remoteVersion = parseRemoteVersion(payload);
        if (active && isNewerVersion(currentVersion, remoteVersion)) {
          foundRef.current = true;
          setHasUpdate(true);
        }
      } catch {
        // 網路失敗時略過，不報錯
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkVersion();
      }
    };

    void checkVersion();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(() => {
      void checkVersion();
    }, VERSION_CHECK_INTERVAL_MS);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  return hasUpdate;
}
