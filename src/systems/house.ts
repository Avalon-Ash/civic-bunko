// 小貓之家系統：擁有 wardrobe.cats、wardrobe.outfitAt、wardrobe.outing、wardrobe.leader。
// 這裡是全專案唯一判斷「這隻是不是原本那隻（HOUSE_FIRST_CAT）」的地方：
// 原本那隻沿用舊欄位（settings.catName／catNameAt、wardrobe.outfit＋outfitAt），其餘讀寫 wardrobe.cats[id]。
import { CAT_CHARACTER } from '../core/constants/catLines';
import {
  HOUSE_ADOPT,
  HOUSE_CAT_ID,
  HOUSE_FIRST_CAT,
  type HouseAdoption,
} from '../core/constants/house';
import { ITEMS, SLOTS } from '../core/constants/wardrobe';
import type {
  CatId,
  CatLook,
  CatProfile,
  HouseCatSave,
  ItemId,
  Outfit,
  SlotId,
  WardrobeItem,
} from '../core/types';
import type { World } from '../core/world';
import { catProfileOf, cleanCatName } from './catBrain';
import { setCatName as setFirstCatName } from './settings';
import { nextChangeTime } from './syncMerge';
import {
  commitWardrobe,
  currentOutfit,
  filterOutfit,
  fishBalance,
  ownedItems,
  type WardrobePatch,
} from './wardrobe';

const ADOPT_BY_CAT = new Map<CatId, HouseAdoption>(
  HOUSE_ADOPT.map((entry) => [entry.cat, entry]),
);
const ITEM_BY_ID = new Map<ItemId, WardrobeItem>(ITEMS.map((item) => [item.id, item]));
const SLOT_ID_SET = new Set<string>(SLOTS.map((s) => s.id));
const defaultNow = (): Date => new Date();

export interface HouseCatView {
  id: CatId;
  /** 畫面顯示名：有取名用名字，沒取名用預設名 */
  name: string;
  /** 使用者取的名字；沒取名是 null */
  named: string | null;
  outfit: Outfit;
  out: boolean;
  leader: boolean;
}

export interface NextAdoptionView {
  cat: CatId;
  price: number;
  short: number;
}

function isFirstCat(id: CatId | undefined): boolean {
  return id === undefined || id === HOUSE_FIRST_CAT;
}

/** 是否為領養貓的合法 ID 格式（符合 HOUSE_CAT_ID 且不是原本那隻） */
export function isAdoptedCatId(id: string): boolean {
  return HOUSE_CAT_ID.test(id) && id !== HOUSE_FIRST_CAT;
}

function cleanLookTime(value: unknown): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : '';
}

/** 目前家裡的所有小貓 ID：原本那隻＋HOUSE_ADOPT 裡已領養的，照表順序；不認得的編號不列。 */
export function houseCatIds(world: World): CatId[] {
  const owned = new Set(world.settings.wardrobe?.owned ?? []);
  const ids: CatId[] = [HOUSE_FIRST_CAT];
  for (const entry of HOUSE_ADOPT) {
    if (owned.has(entry.owned)) {
      ids.push(entry.cat);
    }
  }
  return ids;
}

function catNamed(world: World, id: CatId): string | null {
  if (isFirstCat(id)) {
    return cleanCatName(world.settings.catName);
  }
  return cleanCatName(world.settings.wardrobe?.cats?.[id]?.name);
}

function catDefaultName(id: CatId): string {
  if (isFirstCat(id)) {
    return CAT_CHARACTER.defaultName;
  }
  return ADOPT_BY_CAT.get(id)?.defaultName ?? CAT_CHARACTER.defaultName;
}

/** 讀取指定小貓目前的穿著（套用已擁有、部位相符的過濾）；原本那隻等同 currentOutfit(world)。 */
export function catOutfit(world: World, id: CatId): Outfit {
  if (isFirstCat(id)) {
    return currentOutfit(world);
  }
  if (!houseCatIds(world).includes(id)) {
    return {};
  }
  const saved = world.settings.wardrobe?.cats?.[id]?.outfit;
  return saved ? filterOutfit(world, saved) : {};
}

/** 讀取陪我刷題的小貓 ID；存檔裡的不在家裡時回到原本那隻。 */
export function leaderCat(world: World): CatId {
  const ids = houseCatIds(world);
  const saved = world.settings.wardrobe?.leader;
  return saved && ids.includes(saved) ? saved : HOUSE_FIRST_CAT;
}

/** 讀取帶出門的小貓 ID 清單（只列在家裡的、照家裡順序）；未設定時為全家。 */
export function outingCats(world: World): CatId[] {
  const ids = houseCatIds(world);
  const saved = world.settings.wardrobe?.outing;
  if (saved === undefined) {
    return ids;
  }
  const savedSet = new Set(saved);
  return ids.filter((id) => savedSet.has(id));
}

/** 讀取全家小貓的目前資料（照家裡順序）。 */
export function houseCats(world: World): HouseCatView[] {
  const ids = houseCatIds(world);
  const outSet = new Set(outingCats(world));
  const leader = leaderCat(world);
  return ids.map((id) => {
    const named = catNamed(world, id);
    return {
      id,
      name: named ?? catDefaultName(id),
      named,
      outfit: catOutfit(world, id),
      out: outSet.has(id),
      leader: id === leader,
    };
  });
}

/** 下一隻可以領養的小貓（HOUSE_ADOPT 第一個還沒領養的）；滿了回傳 null。 */
export function nextAdoption(world: World, now: Date = defaultNow()): NextAdoptionView | null {
  const owned = new Set(world.settings.wardrobe?.owned ?? []);
  const next = HOUSE_ADOPT.find((entry) => !owned.has(entry.owned));
  if (!next) return null;
  const { raw } = fishBalance(world, now);
  return {
    cat: next.cat,
    price: next.price,
    short: next.price > 0 ? Math.max(0, next.price - raw) : 0,
  };
}

/** 領養下一隻小貓：加入 owned，並視需要寫入名字與已擁有的毛色。滿了或餘額不足不動作。 */
export function adoptCat(
  world: World,
  options?: { name?: string; fur?: ItemId },
  now: () => Date = defaultNow,
): boolean {
  const nowDate = now();
  const prevOwned = world.settings.wardrobe?.owned ?? [];
  const ownedSet = new Set(prevOwned);
  const next = HOUSE_ADOPT.find((entry) => !ownedSet.has(entry.owned));
  if (!next) return false;
  if (next.price > 0 && fishBalance(world, nowDate).raw < next.price) return false;

  const cleanedName = options?.name !== undefined ? cleanCatName(options.name) : null;
  const furItem = options?.fur !== undefined ? ITEM_BY_ID.get(options.fur) : undefined;
  const validFur =
    furItem !== undefined && furItem.slot === 'fur' && ownedItems(world).has(furItem.id);

  const prevCats = world.settings.wardrobe?.cats;
  const prevEntry = prevCats?.[next.cat];
  let nextCats: Record<CatId, HouseCatSave> | undefined;
  if (cleanedName !== null || validFur) {
    const updated: HouseCatSave = { ...prevEntry };
    if (cleanedName !== null) {
      updated.name = cleanedName;
      updated.nameAt = nextChangeTime(prevEntry?.nameAt, () => nowDate);
    }
    if (validFur && furItem) {
      updated.outfit = { ...prevEntry?.outfit, fur: furItem.id };
      updated.outfitAt = nextChangeTime(prevEntry?.outfitAt, () => nowDate);
    }
    nextCats = { ...prevCats, [next.cat]: updated };
  }

  const prevOuting = world.settings.wardrobe?.outing;
  const nextOuting =
    prevOuting !== undefined
      ? prevOuting.includes(next.cat)
        ? prevOuting
        : [...prevOuting, next.cat]
      : undefined;

  return commitWardrobe(world, {
    owned: [...prevOwned, next.owned],
    ...(nextCats !== undefined ? { cats: nextCats } : {}),
    ...(nextOuting !== undefined ? { outing: nextOuting } : {}),
  });
}

/** 幫指定小貓穿脫配件（未指定＝原本那隻）；只接受已在家裡的小貓與已擁有且部位相符的配件。 */
export function wearCat(
  world: World,
  slot: SlotId,
  item: ItemId | null,
  cat?: CatId,
  now: () => Date = defaultNow,
): boolean {
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

  if (isFirstCat(cat)) {
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

    const outfitAt = nextChangeTime(world.settings.wardrobe?.outfitAt, now);
    return commitWardrobe(world, { outfit: baseOutfit, outfitAt });
  }

  if (!cat || !houseCatIds(world).includes(cat)) {
    return false;
  }

  const prevCats = world.settings.wardrobe?.cats;
  const prevEntry = prevCats?.[cat];
  const baseOutfit: Outfit = { ...prevEntry?.outfit };

  if (item === null) {
    if (!(slot in baseOutfit)) {
      return false;
    }
    delete baseOutfit[slot];
  } else {
    if (baseOutfit[slot] === item) {
      return false;
    }
    baseOutfit[slot] = item;
  }

  const outfitAt = nextChangeTime(prevEntry?.outfitAt, now);
  const updated: HouseCatSave = { ...prevEntry, outfit: baseOutfit, outfitAt };
  return commitWardrobe(world, { cats: { ...prevCats, [cat]: updated } });
}

/** 幫指定小貓取名（未指定或原本那隻走 settings.catName；其他已領養的寫入 wardrobe.cats）。 */
export function setHouseCatName(
  world: World,
  name: string,
  cat?: CatId,
  now: () => Date = defaultNow,
): void {
  if (isFirstCat(cat)) {
    setFirstCatName(world, name, now);
    return;
  }
  if (!cat || !houseCatIds(world).includes(cat)) {
    return;
  }
  const prevCats = world.settings.wardrobe?.cats;
  const prevEntry = prevCats?.[cat];
  const next = cleanCatName(name);
  if (next === cleanCatName(prevEntry?.name)) {
    return;
  }
  const nameAt = nextChangeTime(prevEntry?.nameAt, now);
  const { name: _oldName, ...rest } = prevEntry ?? {};
  const updated: HouseCatSave = {
    ...rest,
    ...(next !== null ? { name: next } : {}),
    nameAt,
  };
  commitWardrobe(world, { cats: { ...prevCats, [cat]: updated } });
}

/** 設定是否帶這隻小貓出門（不限隻數，可以一隻都不帶）；不碰 settings.accessory。 */
export function setCatOuting(world: World, cat: CatId, on: boolean): boolean {
  const ids = houseCatIds(world);
  if (!ids.includes(cat)) {
    return false;
  }
  const current = outingCats(world);
  const isOut = current.includes(cat);
  if (on) {
    if (isOut) {
      return false;
    }
    const nextSet = new Set([...current, cat]);
    return commitWardrobe(world, { outing: ids.filter((id) => nextSet.has(id)) });
  }
  if (!isOut) {
    return false;
  }
  return commitWardrobe(world, { outing: current.filter((id) => id !== cat) });
}

/** 設定陪我刷題的小貓（只接受在家裡的）；不碰 settings.accessory。 */
export function setLeader(world: World, cat: CatId): boolean {
  if (!houseCatIds(world).includes(cat)) {
    return false;
  }
  const saved = world.settings.wardrobe?.leader;
  if (saved === cat || (saved === undefined && isFirstCat(cat))) {
    return false;
  }
  return commitWardrobe(world, { leader: cat });
}

/** 整理本機領養貓的名字資料供同步上傳（不含原本那隻；保留不認得的未來貓）。 */
export function localHouseCatProfiles(world: World): Record<CatId, CatProfile> {
  const out: Record<CatId, CatProfile> = {};
  for (const [id, entry] of Object.entries(world.settings.wardrobe?.cats ?? {})) {
    if (!isAdoptedCatId(id)) continue;
    const profile = catProfileOf({ catName: entry.name, catNameAt: entry.nameAt });
    if (profile !== null) {
      out[id] = profile;
    }
  }
  return out;
}

/** 整理本機全部小貓的長相供同步上傳（含原本那隻與未來貓；沒有有效改動時間的不上傳）。 */
export function localHouseCatLooks(world: World): Record<CatId, CatLook> {
  const out: Record<CatId, CatLook> = {};
  const wardrobe = world.settings.wardrobe;
  if (!wardrobe) return out;

  const firstAt = cleanLookTime(wardrobe.outfitAt);
  if (firstAt !== '' && wardrobe.outfit !== undefined) {
    out[HOUSE_FIRST_CAT] = { outfit: { ...wardrobe.outfit }, at: firstAt };
  }

  for (const [id, entry] of Object.entries(wardrobe.cats ?? {})) {
    if (!isAdoptedCatId(id)) continue;
    const at = cleanLookTime(entry.outfitAt);
    if (at !== '' && entry.outfit !== undefined) {
      out[id] = { outfit: { ...entry.outfit }, at };
    }
  }
  return out;
}

/** 套用同步合併後的領養貓名字與全家小貓長相（擁有者是本系統；同步系統只算出合併結果）。 */
export function applySyncedHouse(
  world: World,
  cats: Readonly<Record<CatId, CatProfile>>,
  looks: Readonly<Record<CatId, CatLook>>,
): void {
  const prev = world.settings.wardrobe;
  const nextCats: Record<CatId, HouseCatSave> = {};

  // 逐欄清理交給 commitWardrobe（catsField）；這裡只挑出領養貓
  for (const [id, entry] of Object.entries(prev?.cats ?? {})) {
    if (isAdoptedCatId(id)) nextCats[id] = { ...entry };
  }

  for (const [id, profile] of Object.entries(cats)) {
    if (!isAdoptedCatId(id)) continue;
    const { name: _oldName, nameAt: _oldAt, ...rest } = nextCats[id] ?? {};
    nextCats[id] = {
      ...rest,
      ...(profile.name !== null ? { name: profile.name } : {}),
      ...(profile.at !== '' ? { nameAt: profile.at } : {}),
    };
  }

  for (const [id, look] of Object.entries(looks)) {
    if (!isAdoptedCatId(id)) continue;
    if (cleanLookTime(look.at) === '') continue;
    nextCats[id] = {
      ...(nextCats[id] ?? {}),
      outfit: { ...look.outfit },
      outfitAt: look.at,
    };
  }

  const patch: WardrobePatch = {};
  const firstLook = looks[HOUSE_FIRST_CAT];
  if (firstLook && cleanLookTime(firstLook.at) !== '') {
    patch.outfit = { ...firstLook.outfit };
    patch.outfitAt = firstLook.at;
  }
  if (Object.keys(nextCats).length > 0) {
    patch.cats = nextCats;
  }

  commitWardrobe(world, patch);
}
