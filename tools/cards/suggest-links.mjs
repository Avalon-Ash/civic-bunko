// 卡片↔官方題連結候選（只印不寫）：node tools/cards/suggest-links.mjs [--any] [--pack <id>]
// 預設比對「正解選項的 lawRef 落在卡片 lawRefs 裡」；加 --any 改成任一選項。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packPaths, resolvePack } from '../paths.mjs';

const argv = process.argv.slice(2);
const anyOption = argv.includes('--any');
const packId = resolvePack(argv);
const paths = packPaths(packId);

const readJsonFiles = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')));
};

const cards = readJsonFiles(paths.cardsDir).flatMap((file) => file.cards ?? []);
const answerById = new Map(
  readJsonFiles(paths.officialDir)
    .flatMap((file) => file.questions ?? [])
    .map((question) => [question.id, question.answer ?? []]),
);
const enrichItems = readJsonFiles(paths.enrichDir).flatMap((file) => file.items ?? []);

const lawKey = (ref) => `${ref.law}#${ref.article}`;
const linked = new Set();

for (const card of cards) {
  if (card.kind === 'essay') continue;
  const lawSet = new Set((card.lawRefs ?? []).map(lawKey));
  const hits =
    lawSet.size === 0
      ? []
      : enrichItems.filter((item) => {
          if (anyOption) {
            return Object.values(item.options ?? {}).some(
              (opt) => opt?.lawRef && lawSet.has(lawKey(opt.lawRef)),
            );
          }
          const answers = answerById.get(item.id) ?? [];
          return answers.some((choice) => {
            const opt = item.options?.[choice];
            return Boolean(opt?.lawRef && lawSet.has(lawKey(opt.lawRef)));
          });
        });

  for (const hit of hits) {
    linked.add(hit.id);
  }
  const suffix = hits.length > 0 ? `: ${hits.map((h) => h.id).join(', ')}` : '';
  console.log(`${card.id} (${hits.length})${suffix}`);
}

console.log(`linked ${linked.size} of ${enrichItems.length}`);
