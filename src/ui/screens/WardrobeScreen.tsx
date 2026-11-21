import { useEffect, useRef, useState, type RefObject } from 'react';
import { ACHIEVEMENTS, DAILY_SALE, SLOTS } from '../../core/constants/wardrobe';
import { dispatch } from '../../core/commands';
import { RUNNER_HOP_MS } from '../../core/constants/pet';
import type { CatId, ItemId, Outfit, SlotId, TryOn } from '../../core/types';
import type { World } from '../../core/world';
import { catOutfit, houseCats, leaderCat, nextAdoption } from '../../selectors/house';
import {
  achievementStatuses,
  dailyTierStatus,
  fishBalance,
  itemStatuses,
  todayQuest,
  toggleTryOn,
  tryOnBasket,
  tryOnEffects,
  tryOnPreview,
  type ItemStatusView,
} from '../../selectors/wardrobe';
import { AdoptSheet } from '../house/AdoptSheet';
import { HouseScene } from '../house/HouseScene';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat, ItemIcon } from '../kit/Cat';
import { CatBody } from '../kit/CatBody';
import { Chip } from '../kit/Chip';
import { CountUp } from '../kit/CountUp';
import { ProgressBar } from '../kit/ProgressBar';
import { CatNameEditor } from '../pet/CatNameEditor';
import { useWorld } from '../useWorld';

/** 成就列表收合時顯示幾個「還沒解鎖」的 */
const ACHIEVEMENTS_PREVIEW = 3;

type SlotFilter = SlotId | 'all';

/** 小魚乾圖示（文字旁的小圖） */
export function FishIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="cb-fish-icon">
      <path d="M17 12 L22.5 8 L22 16 Z" fill="var(--acc-silver)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M2 12 Q9 5 17.5 12 Q9 19 2 12 Z" fill="var(--acc-silver)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="6" cy="11.3" r="1.2" fill="var(--ink)" />
    </svg>
  );
}

function achievementName(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
}

function nonShopCondition(status: ItemStatusView): string | null {
  if (status.state === 'stamps') {
    return `再蓋 ${status.need} 個章就會送你`;
  }
  if (status.state === 'achievement' && status.achievement) {
    return `解鎖成就「${achievementName(status.achievement)}」就會送你`;
  }
  return null;
}

/** 試衣間的小貓圖寬（px）；照片框比它窄（wardrobe.css .cb-wd-room-cat），裁掉姿勢圖兩側的空白 */
const ROOM_CAT_WIDTH = 140;

/** 試衣間裡的全身小貓：坐著；換上新衣服時跳一下；點牠會喵 */
function DressingCat({ name, outfit, cheer }: { name: string; outfit: Outfit; cheer: number }) {
  const [hopping, setHopping] = useState(false);
  useEffect(() => {
    if (cheer === 0) return;
    setHopping(true);
    const id = window.setTimeout(() => setHopping(false), RUNNER_HOP_MS);
    return () => window.clearTimeout(id);
  }, [cheer]);
  return (
    <button
      type="button"
      className="cb-wd-room-cat cb-press"
      data-sound="meow"
      aria-label={`${name}試穿的樣子（點一下會喵）`}
      onClick={() => {
        setHopping(false);
        window.requestAnimationFrame(() => setHopping(true));
        window.setTimeout(() => setHopping(false), RUNNER_HOP_MS);
      }}
    >
      <CatBody pose={hopping ? 'hop' : 'sit'} mood={hopping ? 'yay' : undefined} outfit={outfit} width={ROOM_CAT_WIDTH} backdrop />
    </button>
  );
}

/** 試衣間有沒有黏在捲動區上緣（黏住時把上方的縫蓋掉）；捲動區的上內距直接讀樣式，不另外記一份 */
function useStuck(ref: RefObject<HTMLElement | null>): boolean {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const scroller = el?.closest('.cb-main');
    if (!el || !scroller) return;
    const check = () => {
      const pad = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
      const gap = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      setStuck(scroller.scrollTop > 0 && gap <= pad + 1);
    };
    check();
    scroller.addEventListener('scroll', check, { passive: true });
    return () => scroller.removeEventListener('scroll', check);
  }, [ref]);
  return stuck;
}

export interface WardrobeScreenProps {
  world: World;
}

/** 小貓之家：房間場景、全家名牌列、領養、各自取名與換裝、今日關卡與小任務、成就。 */
export function WardrobeScreen({ world }: WardrobeScreenProps) {
  useWorld(world);
  const now = new Date();
  const cats = houseCats(world);
  const leader = leaderCat(world);
  const adoption = nextAdoption(world, now);
  const fish = fishBalance(world, now);
  const statuses = itemStatuses(world, now);
  const tiers = dailyTierStatus(world, now);
  const quest = todayQuest(world, now);
  const achievements = achievementStatuses(world);

  const [selectedId, setSelectedId] = useState<CatId>(() => leader);
  const [filter, setFilter] = useState<SlotFilter>('all');
  /** 試穿中（還沒拿到）的配件，每個部位最多一件 */
  const [tryOn, setTryOn] = useState<TryOn>({});
  const [showAllAch, setShowAllAch] = useState(false);
  const [happy, setHappy] = useState(0);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [entering, setEntering] = useState<{ id: CatId; tick: number } | null>(null);
  const roomRef = useRef<HTMLDivElement | null>(null);
  const stuck = useStuck(roomRef);

  const selectedCat =
    cats.find((c) => c.id === selectedId) ??
    cats.find((c) => c.id === leader) ??
    cats[0]!;
  const selected = selectedCat.id;

  // 選中的那隻如果不在家裡，回到陪我刷題那隻並清試穿籃
  useEffect(() => {
    if (selectedId !== selected) {
      setSelectedId(selected);
      setTryOn({});
    }
  }, [selectedId, selected]);

  const selectCat = (id: CatId) => {
    if (id === selected) return;
    setSelectedId(id);
    setTryOn({});
  };

  const outfit = catOutfit(world, selected);
  const basket = tryOnBasket(statuses, tryOn, fish.raw);
  const preview: Outfit = tryOnPreview(outfit, basket.tryOn);

  /** 現在這身（含試穿中的配件）的套裝效果 */
  const effects = tryOnEffects(outfit, basket.tryOn);

  /** 今天特價、還沒買的配件 */
  const onSale = statuses.filter((s) => s.base !== undefined);
  const saleLabel = `${Math.round((1 - DAILY_SALE.off) * 10)} 折`;

  const visible = statuses.filter(
    (s) => s.state !== 'off' && (filter === 'all' || s.item.slot === filter),
  );

  const ownedFurs = statuses
    .filter((s) => s.item.slot === 'fur' && s.state === 'owned')
    .map((s) => s.item);

  const handleItem = (id: ItemId) => {
    const status = statuses.find((s) => s.item.id === id);
    if (!status) return;
    if (status.state === 'owned') {
      const slot = status.item.slot;
      setTryOn((cur) => {
        if (!(slot in cur)) return cur;
        const next = { ...cur };
        delete next[slot];
        return next;
      });
      const wearing = outfit[slot] === id;
      dispatch(world, { type: 'wear', slot, item: wearing ? null : id, cat: selected });
      if (!wearing) setHappy((n) => n + 1);
      return;
    }
    setTryOn((cur) => toggleTryOn(cur, status.item));
  };

  const handleBuyAll = () => {
    if (basket.shop.length === 0 || basket.short > 0) return;
    for (const s of basket.shop) {
      dispatch(world, { type: 'buyItem', id: s.item.id });
    }
    for (const s of basket.shop) {
      dispatch(world, { type: 'wear', slot: s.item.slot, item: s.item.id, cat: selected });
    }
    setTryOn({});
    setHappy((n) => n + 1);
  };

  const handleAdopt = (options: { name?: string; fur?: ItemId }) => {
    if (!adoption || adoption.short > 0) return;
    const newId = adoption.cat;
    dispatch(world, { type: 'adoptCat', ...options });
    setAdoptOpen(false);
    setSelectedId(newId);
    setTryOn({});
    setEntering({ id: newId, tick: Date.now() });
  };

  /** 只試穿集章、成就送的配件時：一件就說它的條件；好幾件時條件已經寫在每張籤上，只說一句短的（試衣間是黏住的，不能太高） */
  const nonShopHint =
    basket.items.length > 0 && basket.shop.length === 0
      ? basket.items.length === 1
        ? nonShopCondition(basket.items[0]!)
        : '這幾件是集章、成就送的，不用買；還差什麼寫在下面'
      : null;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const locked = achievements.filter((a) => !a.unlocked);
  const shownAch = showAllAch ? achievements : locked.slice(0, ACHIEVEMENTS_PREVIEW);

  return (
    <div className="cb-stack cb-house-page">
      <div className="cb-page-head cb-wd-head">
        <div className="cb-wd-title">
          <h1>小貓之家</h1>
        </div>
        <span className="cb-fish-pill" aria-label={`小魚乾 ${fish.balance} 條`}>
          <FishIcon />
          <b className="cb-num-tabular">
            <CountUp value={fish.balance} />
          </b>
        </span>
      </div>

      <HouseScene cats={cats} selected={selected} onSelect={selectCat} entering={entering} />

      <div className="cb-house-roster" role="group" aria-label="全家小貓">
        {cats.map((cat) => {
          const isSelected = cat.id === selected;
          return (
            <button
              key={cat.id}
              type="button"
              className={`cb-house-chip cb-press ${isSelected ? 'is-selected' : ''}`.trim()}
              aria-pressed={isSelected}
              onClick={() => selectCat(cat.id)}
            >
              <Cat size={38} interactive={false} outfit={catOutfit(world, cat.id)} />
              <span className="cb-house-chip-name">{cat.name}</span>
            </button>
          );
        })}
        {adoption !== null ? (
          <button
            type="button"
            className="cb-house-chip cb-house-adopt-btn cb-press"
            aria-label={adoption.price === 0 ? '領養新小貓，免費' : `領養新小貓，${adoption.price} 條小魚乾`}
            onClick={() => setAdoptOpen(true)}
          >
            <span className="cb-house-adopt-plus" aria-hidden="true">＋</span>
            <span className="cb-house-chip-name">領養</span>
            {adoption.price === 0 ? (
              <span className="cb-house-adopt-price is-free">免費</span>
            ) : (
              <span className={`cb-house-adopt-price cb-num-tabular ${adoption.short > 0 ? 'is-short' : ''}`.trim()}>
                <FishIcon size={12} />
                {adoption.price}
              </span>
            )}
          </button>
        ) : null}
      </div>

      <div className="cb-house-columns">
        <div className="cb-house-side">
          <Card className="cb-house-selected">
            <CatNameEditor world={world} cat={selected} />
            {selectedCat.leader ? (
              <Chip tone="mint">現在陪你刷題</Chip>
            ) : (
              <Button
                variant="butter"
                className="cb-house-leader-btn"
                onClick={() => dispatch(world, { type: 'setLeader', cat: selected })}
              >
                換牠陪我刷題
              </Button>
            )}
          </Card>

          <Card tone="pink" className="cb-wd-today" data-cat-perch="" data-cat-burn="cat-today">
            <div className="cb-sub-strong">
              今天刷了 <b className="cb-num-tabular">{tiers.count}</b> 題
            </div>
            <ol className="cb-wd-tiers" aria-label="今日題數關卡">
              {tiers.tiers.map((t) => (
                <li key={t.at} className={t.reached ? 'is-reached' : ''}>
                  <span className="cb-wd-tier-at">{t.at} 題</span>
                  <span className="cb-wd-tier-fish">
                    <FishIcon size={14} />+{t.fish}
                  </span>
                </li>
              ))}
            </ol>
            {quest ? (
              <div className={`cb-wd-quest ${quest.done ? 'is-done' : ''}`.trim()}>
                <span className="cb-wd-quest-tag">今日任務</span>
                <span className="cb-grow">{quest.quest.name}</span>
                <span className="cb-wd-tier-fish">
                  {quest.done ? '完成！' : (
                    <>
                      <FishIcon size={14} />+{quest.quest.fish}
                    </>
                  )}
                </span>
              </div>
            ) : null}
            {onSale.length > 0 ? (
              <div className="cb-wd-quest cb-wd-sale">
                <span className="cb-wd-quest-tag">今日特價</span>
                <span className="cb-grow">{onSale.map((s) => s.item.name).join('、')}</span>
                <span className="cb-wd-tier-fish">{saleLabel}</span>
              </div>
            ) : null}
          </Card>
        </div>

        <section className="cb-section cb-wd-dress">
          <h2>換裝</h2>
          {/* 試衣間：捲到下面挑配件時黏在上方，一直看得到小貓穿起來的樣子 */}
          <div ref={roomRef} className={['cb-wd-room', stuck ? 'is-stuck' : '', basket.items.length > 0 ? 'has-try' : ''].filter(Boolean).join(' ')}>
            <DressingCat name={selectedCat.name} outfit={preview} cheer={happy} />
            <div className="cb-wd-room-info" aria-live="polite">
              {basket.items.length > 0 ? (
                <>
                  {basket.shop.length > 0 && basket.short > 0 ? (
                    <p className="cb-sub-strong cb-m0">
                      還差 {basket.short} 條小魚乾，再刷幾題、或先脫掉幾件就買得起！
                    </p>
                  ) : nonShopHint ? (
                    <p className="cb-sub-strong cb-m0">{nonShopHint}</p>
                  ) : null}
                  <div className="cb-wd-room-actions">
                    {basket.shop.length > 0 && basket.short === 0 ? (
                      <Button className="cb-wd-buy" onClick={handleBuyAll}>
                        <span>{basket.shop.length === 1 ? '買下來' : '全部買下來'}</span>
                        <span className="cb-wd-buy-price">
                          <FishIcon size={16} /> {basket.total}
                          {basket.base > basket.total ? <s className="cb-wd-was">{basket.base}</s> : null}
                        </span>
                      </Button>
                    ) : null}
                    <Button variant="ghost" onClick={() => setTryOn({})}>
                      不試了
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <strong>試衣間</strong>
                  {/* 有套裝效果要顯示時，說明換成一句短的（試衣間黏在上方，不能太高） */}
                  <p className="cb-sub cb-m0">
                    {effects.active.length > 0
                      ? `這身有套裝效果，把${selectedCat.name}放出來玩就看得到：`
                      : `點下面的配件，${selectedCat.name}先穿給你看，可以同時試好幾個部位；買過的點一下就換上。`}
                  </p>
                </>
              )}
              {effects.active.length > 0 || effects.near.length > 0 ? (
                <ul className="cb-wd-fx" aria-label="套裝效果">
                  {effects.active.map((fx) => (
                    <li key={fx.id} className="cb-wd-fx-on">
                      <b>{fx.name}</b>
                      {fx.text}
                      {fx.pending ? <span className="cb-wd-fx-pending">（買下來才有）</span> : null}
                    </li>
                  ))}
                  {effects.near.map((fx) => (
                    <li key={fx.id} className="cb-wd-fx-near">
                      再穿上「{fx.missing.join('」或「')}」就有<b>{fx.name}</b>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {basket.items.length > 0 ? (
              <div className="cb-wd-try-list" role="group" aria-label="試穿中的配件">
                {basket.items.map((s) => (
                  <button
                    key={s.item.id}
                    type="button"
                    className="cb-wd-try-pill cb-press"
                    aria-label={`脫掉 ${s.item.name}`}
                    title={s.item.name}
                    onClick={() => setTryOn((cur) => toggleTryOn(cur, s.item))}
                  >
                    <span className="cb-wd-try-icon">
                      <ItemIcon id={s.item.id} size={20} />
                    </span>
                    {s.state === 'buyable' || s.state === 'short' ? (
                      <span className="cb-wd-try-price">
                        <FishIcon size={12} />
                        {s.price}
                      </span>
                    ) : s.state === 'stamps' ? (
                      <span className="cb-wd-try-meta">再 {s.need} 個章</span>
                    ) : (
                      <span className="cb-wd-try-meta">成就獎勵</span>
                    )}
                    <span className="cb-wd-try-x" aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="cb-wd-filters" role="group" aria-label="部位">
            <Chip tone="plain" active={filter === 'all'} onClick={() => setFilter('all')}>
              全部
            </Chip>
            {SLOTS.map((slot) => (
              <Chip key={slot.id} tone="plain" active={filter === slot.id} onClick={() => setFilter(slot.id)}>
                {slot.name}
              </Chip>
            ))}
          </div>
          <div className="cb-acc-grid cb-wd-grid">
            {visible.map((s) => {
              const wearing = outfit[s.item.slot] === s.item.id;
              const isTrying = basket.tryOn[s.item.slot] === s.item.id;
              const owned = s.state === 'owned';
              const meta = owned
                ? wearing
                  ? '穿著中'
                  : '點我穿上'
                : s.state === 'buyable' || s.state === 'short'
                  ? null
                  : s.state === 'stamps'
                    ? `再 ${s.need} 個章`
                    : '成就獎勵';
              return (
                <button
                  key={s.item.id}
                  type="button"
                  className={[
                    'cb-acc-item cb-press',
                    wearing ? 'is-equipped' : '',
                    isTrying ? 'is-trying' : '',
                    owned ? '' : 'is-for-sale',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={owned ? wearing : isTrying}
                  aria-label={`${s.item.name}，${meta ?? `${s.base !== undefined ? '今日特價 ' : ''}${s.price ?? 0} 條小魚乾`}`}
                  onClick={() => handleItem(s.item.id)}
                >
                  <span className="cb-acc-circle">
                    <ItemIcon id={s.item.id} size={38} />
                    {s.base !== undefined ? (
                      <span className="cb-wd-badge is-sale">特價</span>
                    ) : s.item.sprint ? (
                      <span className="cb-wd-badge">限定</span>
                    ) : null}
                  </span>
                  <span className="cb-acc-name">{s.item.name}</span>
                  {meta !== null ? (
                    <span className="cb-acc-meta">{meta}</span>
                  ) : (
                    <span className={`cb-acc-meta cb-wd-price ${s.state === 'short' ? 'is-short' : ''}`.trim()}>
                      <FishIcon size={13} />
                      {s.price}
                      {s.base !== undefined ? <s className="cb-wd-was">{s.base}</s> : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="cb-section cb-house-ach">
          <h2>
            成就 <span className="cb-sub">{unlockedCount} / {achievements.length}</span>
          </h2>
          <div className="cb-stack-sm">
            {shownAch.map((a) => (
              <Card key={a.achievement.id} className={`cb-wd-ach ${a.unlocked ? 'is-unlocked' : ''}`.trim()} data-cat-perch="">
                <div className="cb-row">
                  <div className="cb-grow">
                    <strong>{a.achievement.name}</strong>
                    <div className="cb-sub">{a.achievement.desc}</div>
                  </div>
                  <span className="cb-wd-tier-fish">
                    {a.achievement.item ? <ItemIcon id={a.achievement.item} size={26} /> : null}
                    <FishIcon size={14} />+{a.achievement.fish}
                  </span>
                </div>
                {a.unlocked ? null : (
                  <ProgressBar
                    value={Math.min(a.value, a.achievement.at)}
                    total={a.achievement.at}
                    ariaLabel={`${a.achievement.name} ${a.value} / ${a.achievement.at}`}
                  />
                )}
              </Card>
            ))}
            <Button variant="butter" aria-expanded={showAllAch} onClick={() => setShowAllAch((v) => !v)}>
              {showAllAch ? '只看還沒解鎖的' : `看全部 ${achievements.length} 個成就`}
            </Button>
          </div>
        </section>
      </div>

      <AdoptSheet
        open={adoptOpen}
        onClose={() => setAdoptOpen(false)}
        adoption={adoption}
        catNumber={cats.length + 1}
        ownedFurs={ownedFurs}
        onAdopt={handleAdopt}
      />
    </div>
  );
}
