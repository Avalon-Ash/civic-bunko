import { DAILY_GOAL_QUESTIONS } from '../core/constants/daily';
import {
  ACHIEVEMENTS,
  DAILY_SALE,
  DAILY_TIERS,
  FISH_PER_QUESTION,
  ITEMS,
  OUTFIT_SPECIALS,
  QUESTS,
  QUEST_ROUND_MIN,
  SCORCH,
  SLOTS,
  SPRINT_DAYS,
  WARDROBE_START_DAY,
  WELCOME_FISH,
} from '../core/constants/wardrobe';
import { bumpStore } from '../core/store';
import type {
  Achievement,
  AchievementId,
  AchievementMetric,
  Celebration,
  DayKey,
  ItemId,
  Outfit,
  OutfitSpecial,
  Quest,
  QuestId,
  ScorchPlace,
  SlotId,
  WardrobeItem,
  WardrobeState,
} from '../core/types';
import type { World } from '../core/world';
import { countTotalStamps, isValidDayKey, toDayKey, unlockedAccessories } from './daily';
import { addDaysLocal, toLocalDateString } from './date';
import { cleanRepairs, cleanSaved, type SyncWardrobe } from './syncMerge';

const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const SLOT_ID_SET = new Set<string>(SLOTS.map((s) => s.id));
const ITEM_BY_ID = new Map<ItemId, WardrobeItem>(ITEMS.map((item) => [item.id, item]));
const ACHIEVEMENT_BY_ID = new Map<AchievementId, Achievement>(
  ACHIEVEMENTS.map((ach) => [ach.id, ach]),
);
const QUEST_BY_ID = new Map<QuestId, Quest>(QUESTS.map((quest) => [quest.id, quest]));

const wardrobeUnsubs = new WeakMap<World, () => void>();

const defaultNow = (): Date => new Date();

export interface FishBalanceView {
  balance: number;
  raw: number;
  earned: number;
  spent: number;
  parts: {
    questions: number;
    tiers: number;
    welcome: number;
    achievements: number;
    quests: number;
  };
}

/** 一件商店配件今天的價格 */
export interface ItemPriceView {
  /** 今天買要付多少 */
  price: number;
  /** 原價 */
  base: number;
  /** 今天是不是特價 */
  sale: boolean;
}

export interface TodayQuestView {
  quest: Quest;
  done: boolean;
}

function parseCalendarDayNumber(day: string): number | null {
  if (!isValidDayKey(day)) return null;
  const match = ISO_DATE_RE.exec(day);
  if (!match) return null;
  return Math.floor(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY,
  );
}

function longestStampStreak(dayLog: ReadonlyMap<DayKey, number>): number {
  const days: number[] = [];
  for (const [day, count] of dayLog) {
    if (count < DAILY_GOAL_QUESTIONS) continue;
    const num = parseCalendarDayNumber(day);
    if (num !== null) {
      days.push(num);
    }
  }
  if (days.length === 0) return 0;
  days.sort((a, b) => a - b);

  let best = 1;
  let current = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = days[i - 1];
    const curr = days[i];
    if (prev !== undefined && curr !== undefined && curr === prev + 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

function hasWrongQuestion(world: World): boolean {
  for (const entry of world.progress.values()) {
    if (entry.seen > 0 && entry.streak === 0) {
      return true;
    }
  }
  return false;
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function currentDayKey(now: Date): DayKey {
  return toDayKey(now) ?? toLocalDateString(now);
}

/** 計算所有成就指標的目前數值。 */
export function wardrobeMetrics(world: World): Record<AchievementMetric, number> {
  let answeredTotal = 0;
  for (const count of world.dayLog.values()) {
    answeredTotal += count;
  }

  let mastered = 0;
  for (const entry of world.progress.values()) {
    if (entry.seen > 0 && entry.due === null) {
      mastered += 1;
    }
  }

  const history = world.settings.examHistory ?? [];
  let examBest = 0;
  for (const record of history) {
    if (record.score > examBest) {
      examBest = record.score;
    }
  }

  return {
    answeredTotal,
    mastered,
    stamps: countTotalStamps(world),
    stampStreak: longestStampStreak(world.dayLog),
    cardsSeen: new Set(world.settings.cardsSeen ?? []).size,
    examCount: history.length,
    examBest,
  };
}

/** 有效的已解鎖成就＝存檔裡的 achievements ∪ 目前條件已達成的成就（含尚不認得的 ID）。 */
export function unlockedAchievements(world: World): Set<AchievementId> {
  const unlocked = new Set<AchievementId>(world.settings.wardrobe?.achievements ?? []);
  const metrics = wardrobeMetrics(world);
  for (const ach of ACHIEVEMENTS) {
    if (metrics[ach.metric] >= ach.at) {
      unlocked.add(ach.id);
    }
  }
  return unlocked;
}

/** 目前擁有的配件 ID 集合（集章配件 ∪ 買下的 ∪ 成就送的）。 */
export function ownedItems(world: World): Set<ItemId> {
  const owned = new Set<ItemId>(world.settings.wardrobe?.owned ?? []);
  const totalStamps = countTotalStamps(world);
  const unlocked = unlockedAchievements(world);

  for (const item of ITEMS) {
    if (item.source.kind === 'stamps' && totalStamps >= item.source.stamps) {
      owned.add(item.id);
    } else if (item.source.kind === 'achievement' && unlocked.has(item.source.achievement)) {
      owned.add(item.id);
    }
  }

  for (const ach of ACHIEVEMENTS) {
    if (ach.item && unlocked.has(ach.id)) {
      owned.add(ach.item);
    }
  }

  return owned;
}

/** 檢查目前是否處於任一題庫的衝刺限定期間（examDate − SPRINT_DAYS 到 examDate，兩端含）。 */
export function sprintOpen(world: World, now: Date): boolean {
  const today = currentDayKey(now);
  for (const bank of world.banks) {
    const match = ISO_DATE_RE.exec(bank.examDate);
    if (!match) continue;
    const examDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const startKey = addDaysLocal(examDate, -SPRINT_DAYS);
    if (today >= startKey && today <= bank.examDate) {
      return true;
    }
  }
  return false;
}

/** 現在買得到的商店配件（衝刺限定的只在衝刺期間） */
function onShelf(world: World, now: Date): WardrobeItem[] {
  const sprint = sprintOpen(world, now);
  return ITEMS.filter((item) => item.source.kind === 'shop' && (!item.sprint || sprint));
}

/**
 * 今天特價的配件：架上的商店配件照「日期＋配件 ID」的雜湊排序，取前 DAILY_SALE.count 件。
 * 只看日期和商品清單，不看她買了什麼：買掉一件不會馬上遞補下一件（不然一天之內可以整間打折買完）。
 */
export function saleItems(world: World, now: Date): Set<ItemId> {
  const today = currentDayKey(now);
  const ranked = onShelf(world, now)
    .map((item) => ({ id: item.id, rank: fnv1a(`${today}|${item.id}`) }))
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
  return new Set(ranked.slice(0, DAILY_SALE.count).map((entry) => entry.id));
}

/** 這件配件今天賣多少（唯一算價格的地方；買、畫面、狀態都讀它）。不是商店配件回傳 null */
export function itemPrice(world: World, id: ItemId, now: Date): ItemPriceView | null {
  const item = ITEM_BY_ID.get(id);
  if (!item || item.source.kind !== 'shop') return null;
  const base = item.source.price;
  const sale = saleItems(world, now).has(id);
  return { price: sale ? Math.round(base * (1 - DAILY_SALE.off)) : base, base, sale };
}

/** 這件配件實際花了多少：原價減掉特價時省下的（省下的夾在 0 到原價之間，壞資料不會讓餘額變多） */
function paidFor(item: WardrobeItem, saved: Readonly<Record<ItemId, number>> | undefined): number {
  if (item.source.kind !== 'shop') return 0;
  const off = saved?.[item.id] ?? 0;
  return item.source.price - Math.min(item.source.price, Math.max(0, off));
}

/** 計算小魚乾收入明細、已花費與餘額（balance 為顯示用 ≥ 0，raw 為原始餘額）。 */
export function fishBalance(world: World, _now?: Date): FishBalanceView {
  let questions = 0;
  let tiers = 0;
  for (const [day, count] of world.dayLog) {
    if (day < WARDROBE_START_DAY) continue;
    questions += count * FISH_PER_QUESTION;
    for (const tier of DAILY_TIERS) {
      if (count >= tier.at) {
        tiers += tier.fish;
      }
    }
  }

  const welcome = WELCOME_FISH;

  let achievements = 0;
  for (const id of unlockedAchievements(world)) {
    const ach = ACHIEVEMENT_BY_ID.get(id);
    if (ach) {
      achievements += ach.fish;
    }
  }

  let quests = 0;
  for (const ids of Object.values(world.settings.wardrobe?.quests ?? {})) {
    for (const qId of new Set(ids)) {
      const quest = QUEST_BY_ID.get(qId);
      if (quest) {
        quests += quest.fish;
      }
    }
  }

  let spent = 0;
  for (const id of new Set(world.settings.wardrobe?.owned ?? [])) {
    const item = ITEM_BY_ID.get(id);
    if (item) {
      spent += paidFor(item, world.settings.wardrobe?.saved);
    }
  }

  // 修燒焦花掉的：次數×單價
  spent += (cleanRepairs(world.settings.wardrobe?.repairs) ?? 0) * SCORCH.repairFish;

  const earned = questions + tiers + welcome + achievements + quests;
  const raw = earned - spent;
  return {
    balance: Math.max(0, raw),
    raw,
    earned,
    spent,
    parts: {
      questions,
      tiers,
      welcome,
      achievements,
      quests,
    },
  };
}

/** 讀取貓咪目前各部位穿著；有 wardrobe.outfit 就依它過濾，否則沿用已解鎖的 settings.accessory。 */
export function currentOutfit(world: World): Outfit {
  const savedOutfit = world.settings.wardrobe?.outfit;
  if (savedOutfit !== undefined) {
    const owned = ownedItems(world);
    const out: Outfit = {};
    for (const [slot, itemId] of Object.entries(savedOutfit) as Array<
      [SlotId, ItemId | undefined]
    >) {
      if (!itemId) continue;
      const item = ITEM_BY_ID.get(itemId);
      if (!item || item.slot !== slot) continue;
      if (!owned.has(itemId)) continue;
      out[slot] = itemId;
    }
    return out;
  }

  const legacy = world.settings.accessory ?? null;
  if (legacy !== null && unlockedAccessories(world).includes(legacy)) {
    const item = ITEM_BY_ID.get(legacy);
    if (item) {
      return { [item.slot]: item.id };
    }
  }

  return {};
}

function selectTodayQuest(
  world: World,
  now: Date,
  overrides?: { forceWrongEligible?: boolean; ignoreSeenCardId?: string },
): TodayQuestView | null {
  const today = currentDayKey(now);
  const doneSet = new Set(world.settings.wardrobe?.quests?.[today] ?? []);

  const seenSet = new Set(
    (world.settings.cardsSeen ?? []).filter((id) => id !== overrides?.ignoreSeenCardId),
  );
  const allCardsSeen =
    world.cards.length > 0 && world.cards.every((card) => seenSet.has(card.id));
  const wrongReady = Boolean(overrides?.forceWrongEligible) || hasWrongQuestion(world);

  const pool = QUESTS.filter((q) => {
    if (q.kind === 'new-card') {
      return !allCardsSeen || doneSet.has(q.id);
    }
    if (q.kind === 'wrong-round') {
      return wrongReady || doneSet.has(q.id);
    }
    return true;
  });

  if (pool.length === 0) {
    return null;
  }

  const picked = pool[fnv1a(today) % pool.length];
  if (!picked) {
    return null;
  }
  return {
    quest: picked,
    done: doneSet.has(picked.id),
  };
}

/** 依當地日期與目前狀態挑出今日小任務及完成狀態；若任務池全被排除則回傳 null。 */
export function todayQuest(world: World, now: Date): TodayQuestView | null {
  return selectTodayQuest(world, now);
}

/** 這身穿著有哪些特殊動作（照 OUTFIT_SPECIALS：每個部位都要穿著列出的其中一件） */
export function outfitSpecials(outfit: Outfit): Set<OutfitSpecial> {
  const out = new Set<OutfitSpecial>();
  for (const special of OUTFIT_SPECIALS) {
    const slots = Object.entries(special.wear) as Array<[SlotId, readonly ItemId[]]>;
    if (slots.every(([slot, items]) => items.includes(outfit[slot] ?? ''))) out.add(special.id);
  }
  return out;
}

/** 一處燒焦在存檔裡的 ID：卡片 ID＋位置 */
export function scorchSpotId(card: string, place: ScorchPlace): string {
  return `${card}${SCORCH.sep}${place}`;
}

/** 讀一處燒焦的 ID：哪張卡片、上緣的哪裡。沒寫位置（第一版的存檔）或位置不認得，視為右邊 */
export function parseScorchSpot(spot: string): { card: string; place: ScorchPlace } {
  const at = spot.lastIndexOf(SCORCH.sep);
  const place = at > 0 ? SCORCH.places.find((p) => p === spot.slice(at + 1)) : undefined;
  return place ? { card: spot.slice(0, at), place } : { card: spot, place: 'r' };
}

/** 現在燒焦的地方 */
export function scorchedSpots(world: World): string[] {
  return [...new Set(world.settings.wardrobe?.scorch ?? [])];
}

/** saved 欄位：有東西才寫（沒趁特價買過的人，存檔長得跟以前一樣） */
function savedField(saved: Readonly<Record<ItemId, number>> | undefined): { saved?: Record<ItemId, number> } {
  const clean = cleanSaved(saved);
  return clean ? { saved: clean } : {};
}

/** repairs、scorch 欄位：有東西才寫（沒燒過、沒修過的人，存檔長得跟以前一樣） */
function repairsField(repairs: number | undefined): { repairs?: number } {
  const clean = cleanRepairs(repairs);
  return clean ? { repairs: clean } : {};
}
function scorchField(scorch: readonly string[] | undefined): { scorch?: string[] } {
  return scorch && scorch.length > 0 ? { scorch: [...new Set(scorch)] } : {};
}

function commitWardrobe(
  world: World,
  patch?: {
    owned?: ItemId[];
    /** 這次特價買的那一件省了多少 */
    savedOn?: { id: ItemId; amount: number };
    questCompleted?: { day: DayKey; questId: QuestId };
    outfit?: Outfit;
    /** 燒焦的地方換成這份清單 */
    scorch?: string[];
    /** 修過幾次燒焦（只會變多） */
    repairs?: number;
  },
): boolean {
  const prev = world.settings.wardrobe;
  const prevAchievements = prev?.achievements ?? [];
  const unlocked = unlockedAchievements(world);
  const prevAchSet = new Set(prevAchievements);
  const addedAchievements: AchievementId[] = [];
  for (const id of unlocked) {
    if (!prevAchSet.has(id)) {
      addedAchievements.push(id);
    }
  }

  let questAdded = false;
  const nextQuests: Record<DayKey, QuestId[]> = {};
  if (prev?.quests) {
    for (const [day, ids] of Object.entries(prev.quests)) {
      nextQuests[day] = [...ids];
    }
  }
  if (patch?.questCompleted) {
    const { day, questId } = patch.questCompleted;
    const existing = nextQuests[day] ?? [];
    if (!existing.includes(questId)) {
      nextQuests[day] = [...existing, questId];
      questAdded = true;
    }
  }

  const changed =
    addedAchievements.length > 0 ||
    questAdded ||
    patch?.owned !== undefined ||
    patch?.outfit !== undefined ||
    patch?.scorch !== undefined ||
    patch?.repairs !== undefined;

  if (!changed) {
    return false;
  }

  const nextWardrobe: WardrobeState = {
    owned: patch?.owned ? [...patch.owned] : [...(prev?.owned ?? [])],
    achievements:
      addedAchievements.length > 0
        ? [...prevAchievements, ...addedAchievements]
        : [...prevAchievements],
    quests: nextQuests,
    ...savedField({
      ...prev?.saved,
      ...(patch?.savedOn ? { [patch.savedOn.id]: patch.savedOn.amount } : {}),
    }),
    ...repairsField(patch?.repairs ?? prev?.repairs),
    ...scorchField(patch?.scorch ?? prev?.scorch),
    ...(patch?.outfit !== undefined
      ? { outfit: { ...patch.outfit } }
      : prev?.outfit !== undefined
        ? { outfit: { ...prev.outfit } }
        : {}),
  };

  world.settings = {
    ...world.settings,
    wardrobe: nextWardrobe,
  };
  world.bus.emit({
    type: 'settingsChanged',
    settings: { ...world.settings },
  });
  return true;
}

/** 套用同步合併後的衣櫥資料，保留本機 outfit、scorch 並發出 settingsChanged。 */
export function applySyncedWardrobe(world: World, merged: SyncWardrobe): void {
  const prevOutfit = world.settings.wardrobe?.outfit;
  const prevScorch = world.settings.wardrobe?.scorch;
  const nextQuests: Record<DayKey, QuestId[]> = {};
  for (const [day, ids] of Object.entries(merged.quests)) {
    nextQuests[day] = [...ids];
  }

  world.settings = {
    ...world.settings,
    wardrobe: {
      owned: [...merged.owned],
      achievements: [...merged.achievements],
      quests: nextQuests,
      ...savedField(merged.saved),
      ...repairsField(merged.repairs),
      ...scorchField(prevScorch),
      ...(prevOutfit !== undefined ? { outfit: { ...prevOutfit } } : {}),
    },
  };
  world.bus.emit({
    type: 'settingsChanged',
    settings: { ...world.settings },
  });
}

/** 用小魚乾買一件商店配件（照今天的價格；特價買的記下省了多少）；不符條件（不存在、非商店、已擁有、非衝刺期、餘額不足）時不動作。 */
export function buyItem(
  world: World,
  id: ItemId,
  now: () => Date = defaultNow,
): boolean {
  const item = ITEM_BY_ID.get(id);
  if (!item || item.source.kind !== 'shop') {
    return false;
  }
  if (ownedItems(world).has(id)) {
    return false;
  }
  const nowDate = now();
  if (item.sprint && !sprintOpen(world, nowDate)) {
    return false;
  }
  const cost = itemPrice(world, id, nowDate);
  const { raw } = fishBalance(world, nowDate);
  if (!cost || raw < cost.price) {
    return false;
  }

  const prevOwned = world.settings.wardrobe?.owned ?? [];
  return commitWardrobe(world, {
    owned: [...prevOwned, id],
    ...(cost.sale ? { savedOn: { id, amount: cost.base - cost.price } } : {}),
  });
}

/**
 * 小貓把一個地方燒焦了（只是外觀，不扣小魚乾）。已經燒焦、或燒焦的地方到 SCORCH.max 時不動作。
 */
export function scorchSpot(world: World, spot: string): boolean {
  const now = scorchedSpots(world);
  if (!spot || now.includes(spot) || now.length >= SCORCH.max) return false;
  return commitWardrobe(world, { scorch: [...now, spot] });
}

/** 花 SCORCH.repairFish 條小魚乾把燒焦的地方修好；沒燒焦、餘額不足時不動作。 */
export function repairScorch(world: World, spot: string): boolean {
  const now = scorchedSpots(world);
  if (!now.includes(spot)) return false;
  if (fishBalance(world).raw < SCORCH.repairFish) return false;
  return commitWardrobe(world, {
    scorch: now.filter((id) => id !== spot),
    repairs: (cleanRepairs(world.settings.wardrobe?.repairs) ?? 0) + 1,
  });
}

/** 穿脫指定部位的配件；不改動舊的 settings.accessory。 */
export function wear(world: World, slot: SlotId, item: ItemId | null): boolean {
  if (!SLOT_ID_SET.has(slot)) {
    return false;
  }
  if (item !== null) {
    const def = ITEM_BY_ID.get(item);
    if (!def || def.slot !== slot) {
      return false;
    }
    if (!ownedItems(world).has(item)) {
      return false;
    }
  }

  const hasSavedOutfit = world.settings.wardrobe?.outfit !== undefined;
  const baseOutfit: Outfit = hasSavedOutfit
    ? { ...world.settings.wardrobe?.outfit }
    : currentOutfit(world);

  if (item === null) {
    if (!(slot in baseOutfit)) {
      return false;
    }
    delete baseOutfit[slot];
  } else {
    if (hasSavedOutfit && baseOutfit[slot] === item) {
      return false;
    }
    baseOutfit[slot] = item;
  }

  return commitWardrobe(world, { outfit: baseOutfit });
}

/** 清空畫面待顯示的慶祝清單。 */
export function dismissCelebrations(world: World): void {
  if (world.celebrations.length === 0) {
    return;
  }
  world.celebrations = [];
  bumpStore(world);
}

/**
 * 掛載衣櫥系統：
 * - 讀檔與同步等被動事件只補算慶祝，不寫存檔；
 * - 使用者主動事件（dayLogChanged、roundFinished、examFinished、cardSeen）才記任務與把成就寫進存檔。
 */
export function attachWardrobe(
  world: World,
  options?: { now?: () => Date },
): () => void {
  const prevUnsub = wardrobeUnsubs.get(world);
  if (prevUnsub) {
    prevUnsub();
  }

  const nowFn = options?.now ?? defaultNow;
  const celebrated = new Set<AchievementId>(world.settings.wardrobe?.achievements ?? []);
  let wrongAvailableForRound = false;

  const syncCelebratedFromSave = () => {
    for (const id of world.settings.wardrobe?.achievements ?? []) {
      celebrated.add(id);
    }
  };

  const collectNewAchievements = (): Celebration[] => {
    syncCelebratedFromSave();
    const unlocked = unlockedAchievements(world);
    const added: Celebration[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (unlocked.has(ach.id) && !celebrated.has(ach.id)) {
        celebrated.add(ach.id);
        added.push({ kind: 'achievement', id: ach.id });
      }
    }
    return added;
  };

  const celebratePassive = () => {
    const rewards = collectNewAchievements();
    if (rewards.length === 0) return;
    world.celebrations.push(...rewards);
    world.bus.emit({ type: 'rewardsEarned', rewards: [...rewards] });
    bumpStore(world);
  };

  const handleAction = (questCompleted?: { day: DayKey; questId: QuestId }) => {
    const rewards = collectNewAchievements();
    if (questCompleted) {
      const existing = world.settings.wardrobe?.quests?.[questCompleted.day] ?? [];
      if (!existing.includes(questCompleted.questId)) {
        rewards.push({ kind: 'quest', id: questCompleted.questId });
      }
    }

    if (rewards.length > 0) {
      world.celebrations.push(...rewards);
    }

    const committed = commitWardrobe(
      world,
      questCompleted ? { questCompleted } : undefined,
    );

    if (rewards.length > 0) {
      world.bus.emit({ type: 'rewardsEarned', rewards: [...rewards] });
      if (!committed) {
        bumpStore(world);
      }
    }
  };

  const unsubRoundStarted = world.bus.on('roundStarted', () => {
    wrongAvailableForRound = hasWrongQuestion(world);
  });

  const unsubBankLoaded = world.bus.on('bankLoaded', celebratePassive);
  const unsubCardsLoaded = world.bus.on('cardsLoaded', celebratePassive);
  const unsubProgressChanged = world.bus.on('progressChanged', celebratePassive);
  const unsubSettingsChanged = world.bus.on('settingsChanged', celebratePassive);

  const unsubDayLog = world.bus.on('dayLogChanged', () => {
    handleAction();
  });

  const unsubRoundFinished = world.bus.on('roundFinished', (event) => {
    const nowDate = nowFn();
    const today = currentDayKey(nowDate);
    const eventDay = toDayKey(event.at);
    const wrongEligible = wrongAvailableForRound;
    wrongAvailableForRound = false;

    let questCompleted: { day: DayKey; questId: QuestId } | undefined;
    if (eventDay === today) {
      const picked = selectTodayQuest(world, nowDate, { forceWrongEligible: wrongEligible });
      if (picked && !picked.done) {
        const { quest } = picked;
        const matched =
          (quest.kind === 'quiz-round' &&
            event.config.study === 'quiz' &&
            !event.config.exam &&
            event.results.length >= QUEST_ROUND_MIN) ||
          (quest.kind === 'wrong-round' &&
            event.config.mode === 'wrong' &&
            !event.config.exam &&
            event.results.length > 0) ||
          (quest.kind === 'topic-round' &&
            Boolean(event.config.topicIds && event.config.topicIds.length > 0) &&
            event.results.length > 0);
        if (matched) {
          questCompleted = { day: today, questId: quest.id };
        }
      }
    }

    handleAction(questCompleted);
  });

  const unsubExamFinished = world.bus.on('examFinished', (event) => {
    const nowDate = nowFn();
    const today = currentDayKey(nowDate);
    const eventDay = toDayKey(event.record.at);

    let questCompleted: { day: DayKey; questId: QuestId } | undefined;
    if (eventDay === today) {
      const picked = selectTodayQuest(world, nowDate);
      if (picked && !picked.done && picked.quest.kind === 'exam') {
        questCompleted = { day: today, questId: picked.quest.id };
      }
    }

    handleAction(questCompleted);
  });

  const unsubCardSeen = world.bus.on('cardSeen', (event) => {
    const nowDate = nowFn();
    const today = currentDayKey(nowDate);
    const eventDay = toDayKey(event.at);

    let questCompleted: { day: DayKey; questId: QuestId } | undefined;
    if (eventDay === today) {
      const picked = selectTodayQuest(world, nowDate, { ignoreSeenCardId: event.id });
      if (picked && !picked.done && picked.quest.kind === 'new-card') {
        questCompleted = { day: today, questId: picked.quest.id };
      }
    }

    handleAction(questCompleted);
  });

  const unsubAll = () => {
    unsubRoundStarted();
    unsubBankLoaded();
    unsubCardsLoaded();
    unsubProgressChanged();
    unsubSettingsChanged();
    unsubDayLog();
    unsubRoundFinished();
    unsubExamFinished();
    unsubCardSeen();
    if (wardrobeUnsubs.get(world) === unsubAll) {
      wardrobeUnsubs.delete(world);
    }
  };

  wardrobeUnsubs.set(world, unsubAll);
  return unsubAll;
}
