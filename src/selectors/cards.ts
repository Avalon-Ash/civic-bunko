import type { CardKind, StudyCard } from '../core/types';
import type { World } from '../core/world';
import { examLabel } from './index';

const DECK_ORDER: readonly { kind: CardKind; label: string }[] = [
  { kind: 'concept', label: '觀念' },
  { kind: 'newlaw', label: '新法' },
  { kind: 'essay', label: '申論' },
];

export interface CardDeckView {
  kind: CardKind;
  label: string;
  total: number;
  seen: number;
}

export interface CardView extends StudyCard {
  seen: boolean;
  subjectShort: string | null;
  paperLabel: string | null;
}

function buildSeenSet(world: World): Set<string> {
  return new Set(world.settings.cardsSeen ?? []);
}

function resolveSubjectShort(world: World, subjectKey: string | null): string | null {
  if (!subjectKey) {
    return null;
  }

  const preferredBankId = world.settings.lastRound?.bankId;
  if (preferredBankId) {
    const preferredBank = world.banks.find((b) => b.id === preferredBankId);
    const match = preferredBank?.subjects.find((s) => s.key === subjectKey);
    if (match) {
      return match.short;
    }
  }

  for (const bank of world.banks) {
    const match = bank.subjects.find((s) => s.key === subjectKey);
    if (match) {
      return match.short;
    }
  }

  return null;
}

function formatEssayPaperLabel(world: World, card: StudyCard): string | null {
  if (!card.essay) {
    return null;
  }

  const paper = world.papers.get(card.essay.paperId);
  if (!paper) {
    return `申論第 ${card.essay.no} 題`;
  }

  return `${paper.year} 年${examLabel(world, paper)}・申論第 ${card.essay.no} 題`;
}

function toCardView(world: World, card: StudyCard, seenSet: ReadonlySet<string>): CardView {
  return {
    ...card,
    seen: seenSet.has(card.id),
    subjectShort: resolveSubjectShort(world, card.subjectKey),
    paperLabel: formatEssayPaperLabel(world, card),
  };
}

export interface CardSubjectView {
  key: string;
  short: string;
  count: number;
}

/** 一組卡片裡出現的科目與張數，依第一次出現的順序；給圖卡列表的科目篩選用。 */
export function cardSubjects(cards: readonly CardView[]): CardSubjectView[] {
  const result: CardSubjectView[] = [];
  const byKey = new Map<string, CardSubjectView>();
  for (const card of cards) {
    if (!card.subjectKey || !card.subjectShort) continue;
    const existing = byKey.get(card.subjectKey);
    if (existing) {
      existing.count += 1;
    } else {
      const entry = { key: card.subjectKey, short: card.subjectShort, count: 1 };
      byKey.set(card.subjectKey, entry);
      result.push(entry);
    }
  }
  return result;
}

/** 依觀念、新法、申論順序統計各類圖卡總數與已看數；沒有卡片的類別不回傳。 */
export function cardDecks(world: World): CardDeckView[] {
  const seenSet = buildSeenSet(world);
  const counts = new Map<CardKind, { total: number; seen: number }>();

  for (const card of world.cards) {
    const bucket = counts.get(card.kind) ?? { total: 0, seen: 0 };
    bucket.total += 1;
    if (seenSet.has(card.id)) {
      bucket.seen += 1;
    }
    counts.set(card.kind, bucket);
  }

  const decks: CardDeckView[] = [];
  for (const { kind, label } of DECK_ORDER) {
    const bucket = counts.get(kind);
    if (!bucket || bucket.total === 0) {
      continue;
    }
    decks.push({
      kind,
      label,
      total: bucket.total,
      seen: bucket.seen,
    });
  }

  return decks;
}

/** 依檔案順序取得指定類別的所有卡片，並附帶已看狀態、科目短名與申論來源標籤。 */
export function cardsOfKind(world: World, kind: CardKind): CardView[] {
  const seenSet = buildSeenSet(world);
  const result: CardView[] = [];

  for (const card of world.cards) {
    if (card.kind !== kind) continue;
    result.push(toCardView(world, card, seenSet));
  }

  return result;
}

/** 依卡片 ID 查詢單張圖卡；找不到回傳 null。 */
export function cardById(world: World, id: string): CardView | null {
  const card = world.cards.find((c) => c.id === id);
  if (!card) {
    return null;
  }
  return toCardView(world, card, buildSeenSet(world));
}
