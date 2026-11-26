// 四格漫畫的純函式：把格子的指標解析成卡片原文、檢查一張卡的漫畫資料。ADR 0020。
// 漫畫不可能出現卡片沒有的字：指標解析不到、pick／sign 不是原文的子字串，comicProblems 就回報。
import { COMIC_CASTS, COMIC_LAYOUTS, COMIC_PROPS, COMIC_SCENES } from '../core/constants/comic';
import type { ComicPanel, ComicTextRef, StudyCard } from '../core/types';

type CardText = Pick<StudyCard, 'hook' | 'faces'>;

/** 指標 → 卡片原文；指不到就是 null */
export function resolveComicText(card: CardText, ref: ComicTextRef): string | null {
  switch (ref.from) {
    case 'hook':
      return card.hook;
    case 'heading':
      return card.faces[ref.face]?.heading ?? null;
    case 'line': {
      const line = card.faces[ref.face]?.lines[ref.line];
      if (line === undefined) return null;
      if (ref.pick === undefined) return line;
      return line.includes(ref.pick) ? ref.pick : null;
    }
  }
}

export interface ComicPanelText {
  text: string;
  sign: string | null;
}

/** 一格要顯示的字；資料壞了（指不到）回 null，畫面就不畫那句 */
export function comicPanelText(card: CardText, panel: ComicPanel): ComicPanelText | null {
  const text = resolveComicText(card, panel.text);
  if (text === null) return null;
  const sign = panel.sign !== undefined && text.includes(panel.sign) ? panel.sign : null;
  return { text, sign };
}

/** 這張卡的漫畫資料哪裡不對（空陣列＝沒問題）；給驗證與看圖頁用 */
export function comicProblems(card: StudyCard): string[] {
  const comic = card.comic;
  if (!comic) return [];
  const out: string[] = [];
  const layout = COMIC_LAYOUTS[comic.layout];
  if (!layout) return [`版型 ${comic.layout} 不在清單裡`];
  if (comic.panels.length < layout.min || comic.panels.length > layout.max) {
    out.push(`${comic.layout} 要 ${layout.min}–${layout.max} 格，現在 ${comic.panels.length} 格`);
  }
  if (comic.layout === 'versus' && !comic.columns) out.push('versus 要有 columns（左右兩欄的標題）');
  if (comic.columns && comic.layout !== 'versus') out.push('只有 versus 用 columns');
  comic.columns?.forEach((ref, i) => {
    if (resolveComicText(card, ref) === null) out.push(`columns[${i}] 指不到原文`);
  });
  comic.panels.forEach((panel, i) => {
    const at = `第 ${i + 1} 格`;
    const scene = COMIC_SCENES[panel.scene];
    if (!scene) {
      out.push(`${at}的構圖 ${panel.scene} 不在清單裡`);
    } else {
      if (panel.actors.length > scene.actors) out.push(`${at}的構圖 ${panel.scene} 最多 ${scene.actors} 隻貓`);
      if (panel.props.length > scene.props) out.push(`${at}的構圖 ${panel.scene} 最多 ${scene.props} 樣道具`);
    }
    for (const actor of panel.actors) {
      if (!COMIC_CASTS[actor.cast]) out.push(`${at}的角色 ${actor.cast} 不在清單裡`);
    }
    for (const prop of panel.props) {
      if (!COMIC_PROPS[prop]) out.push(`${at}的道具 ${prop} 不在清單裡`);
    }
    const text = resolveComicText(card, panel.text);
    if (text === null) {
      out.push(`${at}的字指不到原文（${JSON.stringify(panel.text)}）`);
    } else if (panel.sign !== undefined && !text.includes(panel.sign)) {
      out.push(`${at}的舉牌「${panel.sign}」不是「${text}」的一部分`);
    }
  });
  return out;
}

/** 這張卡有沒有漫畫（給圖卡列表的小圖與篩選用） */
export function cardHasComic(card: Pick<StudyCard, 'comic'>): boolean {
  return card.comic !== undefined && card.comic.panels.length > 0;
}
