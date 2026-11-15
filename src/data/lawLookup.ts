import type { LawFile, LawIndex, LawRef } from '../core/types';

export interface LawArticleResult {
  status: 'found' | 'not_found';
  lawName: string;
  amendedAt: string | null;
  url: string | null;
  articleNo: string;
  text: string | null;
}

/** 去除條號前後的「第」「條」與空白，統一成索引鍵格式（例 "26"、"17-1"）。 */
export function normalizeArticleNo(raw: string): string {
  return raw
    .trim()
    .replace(/^第\s*/, '')
    .replace(/\s*條$/, '')
    .trim();
}

/** 格式化法條標籤顯示文字（例「地方制度法 第 26 條」）。 */
export function formatLawRef(ref: LawRef): string {
  const no = normalizeArticleNo(ref.article);
  return no ? `${ref.law} 第 ${no} 條` : ref.law;
}

/** 依名稱從法規索引找出對應條目。 */
export function findLawEntry(
  index: LawIndex,
  lawName: string,
): LawIndex['laws'][number] | null {
  const target = lawName.trim();
  if (!target) return null;
  return index.laws.find((entry) => entry.name === target) ?? null;
}

/** 從已載入的法規全文尋找指定條號。 */
export function findArticleInLaw(
  lawFile: LawFile,
  articleNo: string,
): LawFile['articles'][number] | null {
  const raw = articleNo.trim();
  if (!raw) return null;
  const exact = lawFile.articles.find((a) => a.no === raw);
  if (exact) return exact;
  const normalized = normalizeArticleNo(raw);
  return lawFile.articles.find((a) => a.no === normalized) ?? null;
}

/** 建立帶 pcode 快取的非同步法條查詢器。 */
export function createLawArticleLoader(
  index: LawIndex,
  loadByPcode: (pcode: string) => Promise<LawFile | null>,
): { loadArticle: (ref: LawRef) => Promise<LawArticleResult> } {
  const cache = new Map<string, Promise<LawFile | null>>();

  const getLawFile = (pcode: string): Promise<LawFile | null> => {
    const existing = cache.get(pcode);
    if (existing) return existing;

    const pending = loadByPcode(pcode)
      .then((file) => {
        if (!file) {
          cache.delete(pcode);
        }
        return file ?? null;
      })
      .catch(() => {
        cache.delete(pcode);
        return null;
      });
    cache.set(pcode, pending);
    return pending;
  };

  return {
    async loadArticle(ref: LawRef): Promise<LawArticleResult> {
      const normalizedNo = normalizeArticleNo(ref.article);
      const entry = findLawEntry(index, ref.law);
      if (!entry) {
        return {
          status: 'not_found',
          lawName: ref.law,
          amendedAt: null,
          url: null,
          articleNo: normalizedNo,
          text: null,
        };
      }

      const lawFile = await getLawFile(entry.pcode);
      if (!lawFile) {
        return {
          status: 'not_found',
          lawName: entry.name,
          amendedAt: entry.amendedAt,
          url: null,
          articleNo: normalizedNo,
          text: null,
        };
      }

      const article = findArticleInLaw(lawFile, ref.article);
      if (!article) {
        return {
          status: 'not_found',
          lawName: lawFile.name,
          amendedAt: lawFile.amendedAt,
          url: lawFile.url,
          articleNo: normalizedNo,
          text: null,
        };
      }

      return {
        status: 'found',
        lawName: lawFile.name,
        amendedAt: lawFile.amendedAt,
        url: lawFile.url,
        articleNo: article.no,
        text: article.text,
      };
    },
  };
}
