import { useEffect, useRef, useState } from 'react';
import { dispatch } from '../../core/commands';
import { ACCESSORIES, STAMPS_PER_REWARD } from '../../core/constants/daily';
import { WEAK_MIN_ANSWERED, WEAK_ROUND_COUNT } from '../../core/constants/weak';
import type { AccessoryId } from '../../core/types';
import type { World } from '../../core/world';
import { activeBank, availableCount, subjectStats } from '../../selectors';
import { currentAccessory, stampTotals } from '../../selectors/daily';
import { frequentRoundConfig, frequentTopics } from '../../selectors/frequent';
import { topicStats, weakRoundConfig, weakSummary, weakTopics } from '../../selectors/weak';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { AccessoryIcon, Cat } from '../kit/Cat';
import { SyncBackupSection } from '../components/SyncBackupSection';
import { TopicList } from '../components/TopicList';
import { CountUp } from '../kit/CountUp';
import { ProgressBar } from '../kit/ProgressBar';
import { formatAppVersion, getCurrentAppVersion } from '../useAppVersion';
import { useWorld } from '../useWorld';

export interface StampsScreenProps {
  world: World;
  papersLoading?: boolean;
  onStartQuiz?: () => void;
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 集章畫面：顯示我的章與小貓配件、弱點考點、各科總題數與答對率，以及最下方的同步與備份區塊。 */
export function StampsScreen({ world, papersLoading = false, onStartQuiz }: StampsScreenProps) {
  useWorld(world);
  const bank = activeBank(world);
  const stats = bank ? subjectStats(world, bank.id) : [];
  const totals = stampTotals(world);
  const equipped = currentAccessory(world);

  const now = new Date();
  const weakList = bank ? weakTopics(world, bank.id) : [];
  const weakAllStats = bank ? topicStats(world, bank.id) : [];
  const weakInfo = bank
    ? weakSummary(world, bank.id)
    : { ready: false, answeredTotal: 0, topicCount: 0 };
  const weakAllConfig = bank ? weakRoundConfig(world, bank.id) : null;
  const weakAvail = weakAllConfig ? availableCount(world, weakAllConfig, now) : 0;
  const weakCount = Math.min(WEAK_ROUND_COUNT, weakAvail);
  const noMistakesYet =
    weakInfo.answeredTotal > 0 &&
    (weakInfo.answeredTotal >= WEAK_ROUND_COUNT ||
      weakAllStats.some((t) => t.answered >= WEAK_MIN_ANSWERED)) &&
    weakAllStats.every((t) => t.wrongAttempts === 0);

  const freqList = bank ? frequentTopics(world, bank.id) : [];
  const [freqOpen, setFreqOpen] = useState(false);

  const [catSpin, setCatSpin] = useState(false);
  const spinTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
      }
    };
  }, []);

  const triggerCatSpin = () => {
    if (spinTimerRef.current !== null) {
      window.clearTimeout(spinTimerRef.current);
    }
    setCatSpin(false);
    window.requestAnimationFrame(() => {
      setCatSpin(true);
      spinTimerRef.current = window.setTimeout(() => {
        setCatSpin(false);
        spinTimerRef.current = null;
      }, 680);
    });
  };

  const handleToggleAccessory = (id: AccessoryId) => {
    const next = equipped === id ? null : id;
    dispatch(world, { type: 'setAccessory', accessory: next });
    if (next !== null) {
      triggerCatSpin();
    }
  };

  const versionLabel = formatAppVersion(getCurrentAppVersion());

  const handleStartAllWeak = () => {
    if (papersLoading || !weakAllConfig || weakCount === 0) return;
    dispatch(world, { type: 'startRound', config: weakAllConfig });
    onStartQuiz?.();
  };

  const handleStartSingleWeak = (topicId: string) => {
    if (papersLoading || !bank) return;
    const config = weakRoundConfig(world, bank.id, [topicId]);
    if (!config) return;
    dispatch(world, { type: 'startRound', config });
    onStartQuiz?.();
  };

  const handleStartSingleFreq = (topicId: string) => {
    if (papersLoading || !bank) return;
    const config = frequentRoundConfig(world, bank.id, [topicId]);
    if (!config) return;
    dispatch(world, { type: 'startRound', config });
    onStartQuiz?.();
  };

  return (
    <div className="cb-stack">

      <div className="cb-page-head">
        <h1>集章</h1>
        {papersLoading && <span className="cb-sub">題庫載入中…</span>}
      </div>

      <Card tone="pink" className="cb-stack-sm cb-stamps-hero">
        <div className="cb-row">
          <Cat size={76} mood="yay" accessory={equipped} spin={catSpin} interactive />
          <div className="cb-grow">
            <div className="cb-sub-strong">我的章</div>
            <div className="cb-stamps-count">
              <b>
                <CountUp value={totals.total} />
              </b>{' '}
              個章
            </div>
            <div className="cb-sub-strong">
              {totals.next
                ? `再 ${totals.next.need} 個章解鎖 ${totals.next.name}`
                : '六個配件全部解鎖了！'}
            </div>
          </div>
        </div>

        <div className="cb-acc-grid" role="group" aria-label="小貓配件">
          {ACCESSORIES.map((acc, idx) => {
            const threshold = (idx + 1) * STAMPS_PER_REWARD;
            const isUnlocked = totals.unlocked.includes(acc.id);
            const isEquipped = equipped === acc.id;
            const need = Math.max(1, threshold - totals.total);

            if (isUnlocked) {
              return (
                <button
                  key={acc.id}
                  type="button"
                  className={`cb-acc-item cb-press ${isEquipped ? 'is-equipped' : ''}`.trim()}
                  aria-pressed={isEquipped}
                  onClick={() => handleToggleAccessory(acc.id)}
                >
                  <span className="cb-acc-circle">
                    <AccessoryIcon id={acc.id} size={36} />
                  </span>
                  <span className="cb-acc-name">{acc.name}</span>
                  <span className="cb-acc-meta">{isEquipped ? '配戴中' : '點我戴上'}</span>
                </button>
              );
            }

            return (
              <div
                key={acc.id}
                className="cb-acc-item is-locked"
                aria-label={`${acc.name}，未解鎖，再 ${need} 個章解鎖`}
              >
                <span className="cb-acc-circle">
                  <span className="cb-acc-silhouette" aria-hidden="true">
                    <AccessoryIcon id={acc.id} size={36} />
                  </span>
                  <span className="cb-acc-lock" aria-hidden="true">
                    <LockIcon />
                  </span>
                </span>
                <span className="cb-acc-name">{acc.name}</span>
                <span className="cb-acc-meta">再 {need} 個章</span>
              </div>
            );
          })}
        </div>
      </Card>

      <section className="cb-section">
        <h2>弱點考點</h2>
        {papersLoading ? (
          <Card>
            <p className="cb-sub cb-m0">題庫載入中…</p>
          </Card>
        ) : weakList.length > 0 && weakAllConfig && weakCount > 0 ? (
          <div className="cb-stack-sm">
            <Button onClick={handleStartAllWeak}>刷弱點 {weakCount} 題</Button>
            <TopicList
              tone="weak"
              items={weakList.map((topic) => ({
                id: topic.id,
                subjectShort: topic.subjectShort,
                name: topic.name,
                detail: `答錯 ${topic.wrongAttempts} 次／作答 ${topic.attempts} 次`,
                ratio: topic.wrongRate,
              }))}
              onSolo={handleStartSingleWeak}
            />
          </div>
        ) : (
          <Card className="cb-weak-empty">
            <Cat size={54} mood={noMistakesYet ? 'yay' : 'idle'} interactive={false} />
            <p className="cb-sub-strong cb-m0 cb-grow">
              {noMistakesYet
                ? '目前沒有明顯的弱點，繼續保持'
                : '再多刷幾題，我就能找出你常錯的考點'}
            </p>
          </Card>
        )}
      </section>

      {!papersLoading && freqList.length > 0 ? (
        <section className="cb-section">
          <h2>高頻考點</h2>
          <Button
            variant="butter"
            aria-expanded={freqOpen}
            onClick={() => setFreqOpen((v) => !v)}
          >
            {freqOpen ? '收起高頻考點' : `看每科最常考的 ${freqList.length} 個考點`}
          </Button>
          {freqOpen ? (
            <TopicList
              tone="freq"
              items={freqList.map((topic) => ({
                id: topic.id,
                subjectShort: topic.subjectShort,
                name: topic.name,
                detail: `歷年 ${topic.total} 題・你刷過 ${topic.answered} 題`,
                ratio: topic.total > 0 ? topic.answered / topic.total : 0,
              }))}
              onSolo={handleStartSingleFreq}
            />
          ) : null}
        </section>
      ) : null}

      {stats.length > 0 ? (
        <div className="cb-stack-sm">
          {stats.map((stat) => {
            const pct = Math.round(stat.correctRate * 100);
            return (
              <Card key={stat.key} className="cb-stack-xs">
                <div className="cb-row">
                  <strong className="cb-grow">{stat.name}</strong>
                  <span className="cb-sub-strong">
                    {stat.seen > 0 ? `答對率 ${pct}%` : '尚未作答'}
                  </span>
                </div>
                <div className="cb-sub">
                  {papersLoading ? '載入中…' : `已刷 ${stat.seen} / ${stat.total} 題`}
                </div>
                <ProgressBar
                  value={stat.seen}
                  total={Math.max(1, stat.total)}
                  ariaLabel={`${stat.name} 已刷 ${stat.seen} 題，共 ${stat.total} 題`}
                />
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <p className="cb-sub">目前沒有科目統計資料。</p>
        </Card>
      )}

      <SyncBackupSection world={world} />

      {versionLabel && (
        <p className="cb-sub cb-version-note cb-m0">版本 {versionLabel}</p>
      )}
    </div>
  );
}
