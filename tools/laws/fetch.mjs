// 從全國法規資料庫抓現行條文到 data/laws/。零依賴，只在本機手動執行。
// 用法：node tools/laws/fetch.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const targets = JSON.parse(readFileSync(resolve(root, 'tools/laws/targets.json'), 'utf8'));
const outDir = resolve(root, 'data/laws');
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (html) =>
  html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/div>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

const index = [];
const failed = [];
for (const t of targets.laws) {
  const url = `${targets.baseUrl}?pcode=${t.pcode}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/g, '');
  const name = html.match(/id="hlLawName"[^>]*>([^<]*)/)?.[1]?.trim();
  if (!res.ok || name !== t.name) {
    failed.push(`${t.pcode} 預期「${t.name}」，實際「${name ?? `HTTP ${res.status}`}」`);
    await sleep(targets.delayMs);
    continue;
  }
  const amendedAt = text(html).match(/修正日期：\s*(民國 \d+ 年 \d+ 月 \d+ 日)/)?.[1] ?? null;
  // 每一條：<div class="col-no">…第 N 條…</div> 後面接 <div class="col-data">…</div>
  const articles = [];
  const re = /<div class="col-no">([\s\S]*?)<\/div>\s*<div class="col-data">([\s\S]*?)<\/div>\s*<\/div>\s*(?=<div class="row|<div class="h3|<\/div>)/g;
  for (const m of html.matchAll(re)) {
    const no = text(m[1]).match(/第\s*([\d-]+)\s*條/)?.[1];
    const body = text(m[2]);
    if (no && body) articles.push({ no, text: body });
  }
  if (articles.length === 0) {
    failed.push(`${t.pcode} ${t.name} 解析不到任何條文`);
  } else {
    const file = `data/laws/${t.pcode}.json`;
    writeFileSync(resolve(root, file), JSON.stringify({ pcode: t.pcode, name, amendedAt, url, fetchedAt: new Date().toISOString(), articles }, null, 1) + '\n');
    index.push({ pcode: t.pcode, name, amendedAt, articleCount: articles.length });
    console.log(`${t.pcode} ${name} ${articles.length} 條（${amendedAt}）`);
  }
  await sleep(targets.delayMs);
}
writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ laws: index }, null, 1) + '\n');
for (const f of failed) console.error('ERROR ' + f);
console.log(`laws=${index.length} ERROR=${failed.length}`);
process.exit(failed.length ? 1 : 0);
