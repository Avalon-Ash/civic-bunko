import { useState } from 'react';
import { dispatch } from '../../core/commands';
import type { ThemeChoice } from '../../core/types';
import type { World } from '../../core/world';
import {
  activeBank,
  bankTotals,
  dailyMissions,
  daysLeft,
  getSettings,
  weekActivity,
} from '../../selectors';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { CountUp } from '../kit/CountUp';
import { Segmented, type SegmentedOption } from '../kit/Segmented';
import { useWorld } from '../useWorld';

const THEME_OPTIONS: readonly SegmentedOption<ThemeChoice>[] = [
  { value: 'system', label: '系統' },
  { value: 'light', label: '淺色' },
  { value: 'dark', label: '深色' },
];

export interface TodayScreenProps {
  world: World;
  onStartQuiz: () => void;
  onGoSetup: () => void;
}

function formatExamDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[0]}/${Number(parts[1])}/${Number(parts[2])}`;
}

/** 今日畫面：主題切換、筆試倒數、題庫總數與已刷數、三個 5 題快速任務、本週集章。 */
export function TodayScreen({ world, onStartQuiz, onGoSetup }: TodayScreenProps) {
  useWorld(world);
  const [wobbleState, setWobbleState] = useState<{ idx: number; tick: number } | null>(null);

  const now = new Date();
  const bank = activeBank(world);
  const settings = getSettings(world);
  const totals = bank ? bankTotals(world, bank.id) : { total: 0, seen: 0 };
  const remainingDays = bank ? daysLeft(bank, now) : 0;
  const missions = bank ? dailyMissions(world, bank.id, now) : [];
  const week = weekActivity(world, now);

  const handleThemeChange = (theme: ThemeChoice) => {
    dispatch(world, { type: 'setTheme', theme });
  };

  const handleMissionClick = (index: number) => {
    const mission = missions[index];
    if (!mission) return;
    dispatch(world, { type: 'startRound', config: mission.config });
    onStartQuiz();
  };

  const handleStampTap = (idx: number) => {
    setWobbleState((prev) => ({ idx, tick: (prev?.tick ?? 0) + 1 }));
  };

  return (
    <div className="cb-stack">
      <header className="cb-page-head">
        <h1>今日</h1>
        <Segmented
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={handleThemeChange}
          ariaLabel="畫面主題模式"
        />
      </header>

      {bank ? (
        <>
          <Card tone="pink" className="cb-countdown">
            <Cat size={76} mood="idle" interactive />
            <div className="cb-grow">
              <div className="cb-sub-strong">{bank.title}・距離筆試</div>
              <div className="cb-countdown-num">
                <b>{remainingDays}</b> 天
              </div>
              <div className="cb-sub-strong">考試日 {formatExamDate(bank.examDate)}</div>
            </div>
          </Card>

          <Card className="cb-totals-card">
            <div className="cb-totals-text">
              題庫共 <b><CountUp value={totals.total} /></b> 題・已刷{' '}
              <b><CountUp value={totals.seen} /></b> 題
            </div>
            <div className="cb-sub">
              {totals.total > 0
                ? `完成度 ${Math.round((totals.seen / totals.total) * 100)}%`
                : '尚未載入題庫'}
            </div>
          </Card>

          <section className="cb-section">
            <h2>今天的 3 個小任務</h2>
            {missions.length > 0 ? (
              <div className="cb-stack-sm">
                {missions.map((mission, idx) => (
                  <Card
                    key={mission.id}
                    className="cb-mission"
                    onClick={() => handleMissionClick(idx)}
                  >
                    <span className={`cb-dot cb-tone-${mission.tone}`} aria-hidden="true">
                      {mission.badge}
                    </span>
                    <span className="cb-grow">
                      <strong className="cb-mission-title">{mission.title}</strong>
                      <span className="cb-sub cb-block">{mission.subtitle}</span>
                    </span>
                    <span className="cb-go">開始</span>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <p className="cb-sub">目前沒有可刷題目，去刷題頁調整範圍試試看。</p>
                <div className="cb-mt-sm">
                  <Button onClick={onGoSetup}>前往刷題設定</Button>
                </div>
              </Card>
            )}
          </section>

          <section className="cb-section">
            <h2>這週的章</h2>
            <div className="cb-week">
              {week.map((day, idx) => {
                const isWobbling = wobbleState?.idx === idx;
                return (
                  <button
                    key={isWobbling ? `${day.date}-${wobbleState.tick}` : day.date}
                    type="button"
                    className={[
                      'cb-week-stamp',
                      day.done ? 'is-on' : '',
                      day.isToday ? 'is-today' : '',
                      isWobbling ? 'is-wobbling' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleStampTap(idx)}
                    aria-label={`${day.date} 週${day.label}${day.done ? ' 已完成' : day.isToday ? ' 今天' : ''}`}
                  >
                    {day.done ? '完成' : day.label}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <Card>
          <p className="cb-sub">找不到題庫設定，請確認資料包是否已載入。</p>
        </Card>
      )}
    </div>
  );
}
