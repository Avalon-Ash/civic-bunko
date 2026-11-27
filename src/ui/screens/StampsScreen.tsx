import { dispatch } from '../../core/commands';
import { GUIDE } from '../../core/constants/guide';
import { WEAK_MIN_ANSWERED, WEAK_ROUND_COUNT } from '../../core/constants/weak';
import type { World } from '../../core/world';
import { activeBank, availableCount, subjectStats } from '../../selectors';
import { stampTotals } from '../../selectors/daily';
import { catOutfit, leaderCat } from '../../selectors/house';
import { frequentRoundConfig, frequentTopics } from '../../selectors/frequent';
import { topicStats, weakRoundConfig, weakSummary, weakTopics } from '../../selectors/weak';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Collapse } from '../kit/Collapse';
import { CatHome } from '../pet/CatHome';
import { SyncBackupSection } from '../components/SyncBackupSection';
import { TopicList } from '../components/TopicList';
import { CountUp } from '../kit/CountUp';
import { ProgressBar } from '../kit/ProgressBar';
import { formatAppVersion, getCurrentAppVersion } from '../useAppVersion';
import { useGo } from '../useGuide';
import { useWorld } from '../useWorld';

export interface StampsScreenProps {
  world: World;
  papersLoading?: boolean;
}

/** 集章畫面：顯示我的章（換裝在小貓分頁）、弱點考點、各科總題數與答對率，以及最下方的同步與備份區塊。 */
export function StampsScreen({ world, papersLoading = false }: StampsScreenProps) {
  useWorld(world);
  const go = useGo();
  const bank = activeBank(world);
  const stats = bank ? subjectStats(world, bank.id) : [];
  const totals = stampTotals(world);
  const outfit = catOutfit(world, leaderCat(world));

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

  const versionLabel = formatAppVersion(getCurrentAppVersion());

  const handleStartAllWeak = () => {
    if (papersLoading || !weakAllConfig || weakCount === 0) return;
    dispatch(world, { type: 'startRound', config: weakAllConfig });
    go(GUIDE.roundStarted);
  };

  const handleStartSingleWeak = (topicId: string) => {
    if (papersLoading || !bank) return;
    const config = weakRoundConfig(world, bank.id, [topicId]);
    if (!config) return;
    dispatch(world, { type: 'startRound', config });
    go(GUIDE.roundStarted);
  };

  const handleStartSingleFreq = (topicId: string) => {
    if (papersLoading || !bank) return;
    const config = frequentRoundConfig(world, bank.id, [topicId]);
    if (!config) return;
    dispatch(world, { type: 'startRound', config });
    go(GUIDE.roundStarted);
  };

  return (
    <div className="cb-stack">

      <div className="cb-page-head">
        <h1>集章</h1>
        {papersLoading && <span className="cb-sub">題庫載入中…</span>}
      </div>

      <Card tone="pink" className="cb-stack-sm cb-stamps-hero" data-cat-perch="" data-cat-burn="stamps-hero">
        <div className="cb-row">
          <CatHome world={world} size={76}>
            <Cat size={76} mood="yay" outfit={outfit} interactive />
          </CatHome>
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

        <Button variant="butter" onClick={() => go(GUIDE.dressCat)}>
          幫小貓換裝
        </Button>
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
          <Card className="cb-weak-empty" data-cat-perch="">
            <Cat size={54} mood={noMistakesYet ? 'yay' : 'idle'} interactive={false} />
            <div className="cb-weak-empty-body">
              <p className="cb-sub-strong cb-m0">
                {noMistakesYet
                  ? '目前沒有明顯的弱點，繼續保持'
                  : '再多刷幾題，我就能找出你常錯的考點'}
              </p>
              <Button
                variant="butter"
                className="cb-weak-empty-btn"
                onClick={() => go(GUIDE.weakEmpty)}
              >
                去刷題
              </Button>
            </div>
          </Card>
        )}
      </section>

      {!papersLoading && freqList.length > 0 ? (
        <Collapse title="高頻考點" summary={`每科最常考的 ${freqList.length} 個`}>
          <div className="cb-freq-body">
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
          </div>
        </Collapse>
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
