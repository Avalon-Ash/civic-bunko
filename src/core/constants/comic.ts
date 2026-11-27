// SSOT：四格漫畫的詞彙表（版型、構圖、道具、角色）與上下限。docs/plans/comic-cards.md §2、ADR 0020。
// 卡片資料（pack）只能用這裡列的 ID；驗證（tools/validate/comics.test.mjs）直接讀本檔，沒有第二份清單。
// 漫畫沒有自己的字數上限：字都是卡片原文，受 constants/cards.ts 管。
import type { ComicCast, ComicLayout, ComicPropId, ComicSceneId, Outfit } from '../types';

/**
 * 每種版型：幾格（上下限）、每格要不要標籤（label）。
 * 排排站的每一格是並列的一項（修憲、罷免…），帶數字的那行不含項目名稱，所以要另外指一個標籤。
 */
export const COMIC_LAYOUTS: Readonly<Record<ComicLayout, { name: string; min: number; max: number; needsLabel: boolean }>> = {
  story: { name: '起承轉合', min: 4, max: 4, needsLabel: false },
  timeline: { name: '時間軸', min: 2, max: 5, needsLabel: false },
  versus: { name: '左右對照', min: 2, max: 4, needsLabel: false },
  ladder: { name: '上到下', min: 2, max: 4, needsLabel: false },
  lineup: { name: '排排站', min: 2, max: 5, needsLabel: true },
};

/** story 版型四格的角標（引擎的介面字，不是內容） */
export const COMIC_STORY_BEATS = ['起', '承', '轉', '合'] as const;

/** 構圖模板：每格最多幾個演員、幾樣道具（擺位在 ui/kit/comic/scenes.ts） */
export const COMIC_SCENES: Readonly<Record<ComicSceneId, { name: string; actors: number; props: number }>> = {
  solo: { name: '一隻貓＋道具', actors: 1, props: 2 },
  duo: { name: '兩隻貓面對面', actors: 2, props: 1 },
  'prop-big': { name: '大道具＋旁邊一隻小貓', actors: 1, props: 1 },
  crowd: { name: '三隻貓排排站', actors: 3, props: 1 },
};

/** 道具的名稱（給看圖頁、無障礙標籤用） */
export const COMIC_PROPS: Readonly<Record<ComicPropId, string>> = {
  stamp: '印章',
  document: '公文',
  ticket: '罰單',
  envelope: '信封',
  hourglass: '沙漏',
  calendar: '日曆',
  courthouse: '法院',
  office: '辦公大樓',
  pothole: '路面坑洞',
  lamp: '壞掉的路燈',
  target: '靶心',
  door: '大門',
  'torn-paper': '撕破的紙',
  eraser: '橡皮擦',
  coins: '一疊硬幣',
  scissors: '剪刀',
  handcuffs: '手銬',
  'ballot-box': '投票箱',
  crown: '皇冠',
  scale: '天秤',
  fence: '柵欄',
  umbrella: '雨傘',
  magnifier: '放大鏡',
  'test-paper': '考卷',
  house: '房子',
  bench: '公園長椅',
  'money-bag': '錢袋',
  bridge: '拱橋',
  phone: '手機',
  fish: '魚',
  whale: '虎鯨',
};

/**
 * 角色：同一個角色在每張卡都穿一樣，她一看就知道誰是誰。
 * agency＝機關（領帶＋單片眼鏡、灰毛）；citizen＝人民（毛帽、橘毛）；official＝公務員（領結＋學士帽、銀虎斑）；
 * council＝民意代表（立委、議員：貝雷帽、暹羅）；local＝地方政府（頭巾、三花）。
 * 格子小（列表小圖 72px），所以靠毛色＋頭頂的輪廓分辨，臉上的小配件只是加分。
 */
export const COMIC_CASTS: Readonly<Record<ComicCast, { name: string; outfit: Outfit }>> = {
  agency: { name: '機關', outfit: { neck: 'necktie', 'face-mid': 'monocle', fur: 'fur-gray' } },
  citizen: { name: '人民', outfit: { 'head-top': 'beanie', fur: 'fur-orange' } },
  official: { name: '公務員', outfit: { neck: 'bowtie', 'head-top': 'grad-cap', fur: 'fur-silver' } },
  council: { name: '民意代表', outfit: { 'head-top': 'beret', fur: 'fur-siamese' } },
  local: { name: '地方政府', outfit: { 'head-top': 'hachimaki', fur: 'fur-calico' } },
};
