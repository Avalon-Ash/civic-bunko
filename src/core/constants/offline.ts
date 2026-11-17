// SSOT：離線快取的常數。
/** service worker 的快取名稱；public/sw.js 是不經打包的靜態檔，裡面的 CACHE_NAME 必須和這裡相同（offline.test.ts 會檢查）。 */
export const OFFLINE_CACHE_NAME = 'civic-bunko-v1';
/** 打包時產生的資產清單（vite.config.ts 的 versionFile 外掛） */
export const OFFLINE_MANIFEST_PATH = './precache.json';
/** 清單裡會被整理（補抓、清舊）的路徑前綴 */
export const OFFLINE_ASSET_PREFIX = 'assets/';
/** 題庫載入完成後隔多久才開始整理快取，避免和首屏搶頻寬 */
export const OFFLINE_WARM_DELAY_MS = 5000;
