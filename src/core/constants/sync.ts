// SSOT：私人 repo 同步的常數。
/** 同步碼前綴；之後接 base64url(JSON { o, r, t }) */
export const SYNC_CODE_PREFIX = 'cb1.';
/** 憑證在裝置上的儲存鍵（獨立於進度存檔） */
export const SYNC_STORAGE_KEY = 'civic-bunko/sync';
/** 進度檔在私人 repo 裡的路徑 */
export const SYNC_REMOTE_PATH = 'progress.json';
export const SYNC_API_BASE = 'https://api.github.com';
export const SYNC_FILE_VERSION = 1;
