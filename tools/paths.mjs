// 工具取得內容包與共用資料路徑的唯一來源（SSOT）。
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PACKS_DIR = resolve(ROOT, 'data/packs');
export const LAWS_DIR = resolve(ROOT, 'data/laws');
export const RAW_DIR = resolve(ROOT, 'data/raw');

/** 列出 data/packs/ 底下所有含 pack.json 的內容包 id（依字典序排序）。 */
export function listPacks() {
  if (!existsSync(PACKS_DIR)) return [];
  return readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(PACKS_DIR, entry.name, 'pack.json')))
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** 回傳指定內容包的所有目錄與設定檔絕對路徑。 */
export function packPaths(packId) {
  if (!packId || typeof packId !== 'string' || /[/\\]/.test(packId) || packId === '.' || packId === '..') {
    throw new Error(`Invalid packId: ${String(packId)}`);
  }
  const root = resolve(PACKS_DIR, packId);
  return {
    root,
    packFile: resolve(root, 'pack.json'),
    officialDir: resolve(root, 'official'),
    officialIndex: resolve(root, 'official/index.json'),
    enrichDir: resolve(root, 'enrich'),
    zhDir: resolve(root, 'zh'),
    cardsDir: resolve(root, 'cards'),
    topicsFile: resolve(root, 'topics.json'),
    zhSrcDir: resolve(ROOT, 'tools/zh/src', packId),
  };
}

/**
 * 解析命令列指定的內容包 id；pure helper 供 CLI 與測試共用。
 * @returns {{ ok: true, id: string } | { ok: false, error: string }}
 */
export function resolvePackFromArgv(argv = process.argv.slice(2), packs = listPacks()) {
  let specified = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pack') {
      specified = argv[i + 1] ?? '';
      break;
    }
    if (typeof arg === 'string' && arg.startsWith('--pack=')) {
      specified = arg.slice('--pack='.length);
      break;
    }
  }

  if (specified !== null) {
    if (!specified || !packs.includes(specified)) {
      return {
        ok: false,
        error: `找不到內容包「${specified}」。可用的內容包：${packs.join(', ') || '(無)'}`,
      };
    }
    return { ok: true, id: specified };
  }

  if (packs.length === 1) {
    return { ok: true, id: packs[0] };
  }
  if (packs.length === 0) {
    return { ok: false, error: '找不到任何內容包（data/packs/*/pack.json）。' };
  }
  return {
    ok: false,
    error: `有多個內容包，請用 --pack <id> 指定：${packs.join(', ')}`,
  };
}

/** 依命令列參數（--pack <id>）或唯一內容包決定要操作的 packId；無法決定時印出可用 id 並以非零結束。 */
export function resolvePack(argv = process.argv.slice(2)) {
  const res = resolvePackFromArgv(argv);
  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }
  return res.id;
}
