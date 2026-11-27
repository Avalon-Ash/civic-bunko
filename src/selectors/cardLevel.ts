// 圖卡闖關的查詢（ADR 0023）：星星與連連看都從 systems 轉出，畫面只經這裡讀。
export { cardDueCount, cardHasMatch, cardStars, type CardStars } from '../systems/cardStars';
export { comicMatchSet, isComicMatch, type ComicMatchSet } from '../systems/comicMatch';
