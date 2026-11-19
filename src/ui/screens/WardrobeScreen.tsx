import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ACHIEVEMENTS, DAILY_SALE, SLOTS } from '../../core/constants/wardrobe';
import { dispatch } from '../../core/commands';
import { RUNNER_HOP_MS } from '../../core/constants/pet';
import type { ItemId, Outfit, SlotId } from '../../core/types';
import type { World } from '../../core/world';
import {
  achievementStatuses,
  currentOutfit,
  dailyTierStatus,
  fishBalance,
  itemStatuses,
  todayQuest,
} from '../../selectors/wardrobe';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { ItemIcon } from '../kit/Cat';
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

/** 試衣間的小貓圖寬（px）；照片框比它窄（wardrobe.css .cb-wd-room-cat），裁掉姿勢圖兩側的空白 */
const ROOM_CAT_WIDTH = 140;

/** 試衣間裡的全身小貓：坐著；換上新衣服時跳一下；點牠會喵 */
function DressingCat({ outfit, cheer }: { outfit: Outfit; cheer: number }) {
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
      aria-label="小貓試穿的樣子（點一下會喵）"
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

/** 小貓衣櫥：試穿、買配件、今日關卡與小任務、成就。 */
export function WardrobeScreen({ world }: WardrobeScreenProps) {
  useWorld(world);
  const now = new Date();
  const fish = fishBalance(world, now);
  const outfit = currentOutfit(world);
  const statuses = itemStatuses(world, now);
  const tiers = dailyTierStatus(world, now);
  const quest = todayQuest(world, now);
  const achievements = achievementStatuses(world);

  const [filter, setFilter] = useState<SlotFilter>('all');
  /** 試穿中（還沒買）的配件 */
  const [trying, setTrying] = useState<ItemId | null>(null);
  const [showAllAch, setShowAllAch] = useState(false);
  const [happy, setHappy] = useState(0);
  const roomRef = useRef<HTMLDivElement | null>(null);
  const stuck = useStuck(roomRef);

  const tryingStatus = trying ? statuses.find((s) => s.item.id === trying) ?? null : null;
  const preview: Outfit = useMemo(() => {
    if (!tryingStatus) return outfit;
    return { ...outfit, [tryingStatus.item.slot]: tryingStatus.item.id };
  }, [outfit, tryingStatus]);

  /** 今天特價、還沒買的配件 */
  const onSale = statuses.filter((s) => s.base !== undefined);
  const saleLabel = `${Math.round((1 - DAILY_SALE.off) * 10)} 折`;

  const visible = statuses.filter(
    (s) => s.state !== 'off' && (filter === 'all' || s.item.slot === filter),
  );

  const handleItem = (id: ItemId) => {
    const status = statuses.find((s) => s.item.id === id);
    if (!status) return;
    if (status.state === 'owned') {
      setTrying(null);
      const wearing = outfit[status.item.slot] === id;
      dispatch(world, { type: 'wear', slot: status.item.slot, item: wearing ? null : id });
      if (!wearing) setHappy((n) => n + 1);
      return;
    }
    setTrying((cur) => (cur === id ? null : id));
  };

  const handleBuy = () => {
    if (!tryingStatus || tryingStatus.state !== 'buyable') return;
    const { id, slot } = tryingStatus.item;
    dispatch(world, { type: 'buyItem', id });
    dispatch(world, { type: 'wear', slot, item: id });
    setTrying(null);
    setHappy((n) => n + 1);
  };

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const locked = achievements.filter((a) => !a.unlocked);
  const shownAch = showAllAch ? achievements : locked.slice(0, ACHIEVEMENTS_PREVIEW);

  return (
    <div className="cb-stack">
      <div className="cb-page-head cb-wd-head">
        <div className="cb-wd-title">
          <h1>小貓衣櫥</h1>
          <CatNameEditor world={world} />
        </div>
        <span className="cb-fish-pill" aria-label={`小魚乾 ${fish.balance} 條`}>
          <FishIcon />
          <b className="cb-num-tabular">
            <CountUp value={fish.balance} />
          </b>
        </span>
      </div>

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

      <section className="cb-section cb-wd-dress">
        <h2>換裝</h2>
        {/* 試衣間：捲到下面挑配件時黏在上方，一直看得到小貓穿起來的樣子 */}
        <div ref={roomRef} className={`cb-wd-room ${stuck ? 'is-stuck' : ''}`.trim()}>
          <DressingCat outfit={preview} cheer={happy} />
          <div className="cb-wd-room-info" aria-live="polite">
            {tryingStatus ? (
              <>
                <div className="cb-wd-try-name">
                  試穿：<b>{tryingStatus.item.name}</b>
                  {tryingStatus.item.sprint ? <Chip tone="orange">考前限定</Chip> : null}
                  {tryingStatus.base !== undefined ? <Chip tone="pink">今日特價</Chip> : null}
                </div>
                {tryingStatus.state === 'buyable' ? null : tryingStatus.state === 'short' ? (
                  <p className="cb-sub-strong cb-m0">
                    還差 {tryingStatus.price !== undefined ? tryingStatus.price - fish.raw : 0} 條小魚乾，再刷幾題就買得起！
                  </p>
                ) : tryingStatus.state === 'stamps' ? (
                  <p className="cb-sub-strong cb-m0">再蓋 {tryingStatus.need} 個章就會送你</p>
                ) : tryingStatus.state === 'achievement' && tryingStatus.achievement ? (
                  <p className="cb-sub-strong cb-m0">
                    解鎖成就「{achievementName(tryingStatus.achievement)}」就會送你
                  </p>
                ) : null}
                <div className="cb-wd-room-actions">
                  {tryingStatus.state === 'buyable' ? (
                    <Button onClick={handleBuy}>
                      <FishIcon /> {tryingStatus.price} 買下來
                      {tryingStatus.base !== undefined ? <s className="cb-wd-was">{tryingStatus.base}</s> : null}
                    </Button>
                  ) : null}
                  <Button variant="ghost" onClick={() => setTrying(null)}>
                    不試了
                  </Button>
                </div>
              </>
            ) : (
              <>
                <strong>試衣間</strong>
                <p className="cb-sub cb-m0">點下面的配件，小貓先穿給你看；買過的點一下就換上。</p>
              </>
            )}
          </div>
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
            const isTrying = trying === s.item.id;
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

      <section className="cb-section">
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
  );
}
