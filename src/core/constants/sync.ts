// SSOT：私人 repo 同步的常數。
/** 同步碼前綴；之後接 base64url(JSON { o, r, t }) */
export const SYNC_CODE_PREFIX = 'cb1.';
/** 憑證在裝置上的儲存鍵（獨立於進度存檔） */
export const SYNC_STORAGE_KEY = 'civic-bunko/sync';
/** 進度檔在私人 repo 裡的路徑 */
export const SYNC_REMOTE_PATH = 'progress.json';
export const SYNC_API_BASE = 'https://api.github.com';
export const SYNC_FILE_VERSION = 1;
/** App 切到背景或回到前景時自動同步；兩次之間至少隔這麼久，避免快速切換 App 時連續打 API */
export const SYNC_VISIBILITY_MIN_INTERVAL_MS = 15_000;
