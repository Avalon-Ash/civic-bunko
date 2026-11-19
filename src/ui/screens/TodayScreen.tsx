import { useEffect, useState } from 'react';
import { dispatch } from '../../core/commands';
import { DAILY_GOAL_QUESTIONS } from '../../core/constants/daily';
import type { DayKey, ThemeChoice } from '../../core/types';
import type { World } from '../../core/world';
import {
  activeBank,
  bankTotals,
  dailyMissions,
  daysLeft,
  getSettings,
  savedRoundInfo,
} from '../../selectors';
import { todayProgress, weekStamps } from '../../selectors/daily';
import { currentOutfit, fishBalance, todayQuest } from '../../selectors/wardrobe';
import { FishIcon } from './WardrobeScreen';
import { soundOn } from '../../selectors/sound';
import { weatherOn, weatherPlace } from '../../selectors/weather';
import { WEATHER_LABEL, WEATHER_PLACES } from '../../core/constants/weather';
import type { WeatherView } from '../useWeather';
import { Switch } from '../kit/Switch';
import { CatHome } from '../pet/CatHome';
import { getSyncState } from '../../selectors/sync';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Chip } from '../kit/Chip';
import { Cat } from '../kit/Cat';
import { CountUp } from '../kit/CountUp';
import { Segmented, type SegmentedOption } from '../kit/Segmented';
import { Toast } from '../kit/Toast';
import { checkForUpdateNow, formatAppVersion, getCurrentAppVersion } from '../useAppVersion';
import { useWorld } from '../useWorld';

const THEME_OPTIONS: readonly SegmentedOption<ThemeChoice>[] = [
  { value: 'system', label: '系統' },
  { value: 'light', label: '淺色' },
  { value: 'dark', label: '深色' },
];

export interface StampCelebration {
  day: DayKey;
  unlockedName: string | null;
}

/** 天氣天空開關底下那行說明：關著時講它會做什麼，開著時講現在的結果或問不到的原因 */
function weatherNote(on: boolean, view: WeatherView | undefined, placeName: string | null): string {
  if (!on) return '頁面上方照外面的天氣畫晴天、多雲或下雨；可以用手機定位，也可以自己選縣市';
  const where = placeName ?? '外面';
  switch (view?.status) {
    case 'ok':
      return view.weather ? `現在${where}：${WEATHER_LABEL[view.weather.kind]}（天氣資料：Open-Meteo）` : '正在問天氣…';
    case 'denied':
      return '定位被擋住了（沒有允許，或手機、電腦的定位服務關著），所以沒有跳出詢問。打開定位後按「再試一次」，或直接在下面選縣市';
    case 'nofix':
      return '定位開著，但抓不到位置。按「再試一次」，或直接在下面選縣市';
    case 'unsupported':
      return '這個瀏覽器沒有定位功能，請在下面選縣市';
    case 'offline':
      return '現在問不到天氣（可能沒有網路），按「再試一次」';
    case 'waiting':
      return '按「問天氣」看看外面的天氣（會問你要不要給定位），或直接在下面選縣市';
    default:
      return '正在問天氣…';
  }
}
/** 這些狀態要給一顆重問的按鈕，和按鈕上的字 */
const WEATHER_RETRY: Partial<Record<WeatherView['status'], string>> = {
  waiting: '問天氣',
  denied: '再試一次',
  nofix: '再試一次',
  offline: '再試一次',
};

export interface TodayScreenProps {
  world: World;
  onStartQuiz: () => void;
  onGoSetup: () => void;
  onGoStamps?: () => void;
  /** 打開小貓衣櫥分頁 */
  onGoCat?: () => void;
  /** 打開完整的更新紀錄 */
  onOpenChangelog?: () => void;
  papersLoading?: boolean;
  loadError?: boolean;
  showInstallHint?: boolean;
  /** 天氣天空現在的狀態（問到了沒、是什麼天氣） */
  weather?: WeatherView;
  onOpenInstallHint?: () => void;
  celebration?: StampCelebration | null;
  onCelebrationDone?: () => void;
}

function formatExamDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[0]}/${Number(parts[1])}/${Number(parts[2])}`;
}

/** 今日畫面：主題切換、筆試倒數、題庫總數與已刷數、三個 5 題快速任務、本週集章。 */
export function TodayScreen({
  world,
  onStartQuiz,
  onGoSetup,
  onGoStamps,
  onGoCat,
  onOpenChangelog,
  papersLoading = false,
  loadError = false,
  showInstallHint = false,
  weather,
  onOpenInstallHint,
  celebration = null,
  onCelebrationDone,
}: TodayScreenProps) {
  useWorld(world);
  const [wobbleState, setWobbleState] = useState<{ idx: number; tick: number } | null>(null);
  const [showStampAnim, setShowStampAnim] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [queuedUnlock, setQueuedUnlock] = useState<string | null>(null);

  useEffect(() => {
    if (!celebration) return;
    setShowStampAnim(true);
    setToastMessage('今天的章蓋好了！');
    setQueuedUnlock(celebration.unlockedName);
    onCelebrationDone?.();
  }, [celebration, onCelebrationDone]);

  useEffect(() => {
    if (!showStampAnim) return;
    const timer = window.setTimeout(() => {
      setShowStampAnim(false);
    }, 2100);
    return () => window.clearTimeout(timer);
  }, [showStampAnim]);

  const now = new Date();
  const bank = activeBank(world);
  const settings = getSettings(world);
  const sync = getSyncState(world);
  const savedRound = savedRoundInfo(world);
  const totals = bank ? bankTotals(world, bank.id) : { total: 0, seen: 0 };
  const remainingDays = bank ? daysLeft(bank, now) : 0;
  const missions = bank ? dailyMissions(world, bank.id, now) : [];
  const today = todayProgress(world, now);
  const week = weekStamps(world, now);
  const outfit = currentOutfit(world);
  const quest = todayQuest(world, now);
  const fish = fishBalance(world, now);

  const handleThemeChange = (theme: ThemeChoice) => {
    dispatch(world, { type: 'setTheme', theme });
  };

  const handleResumeSaved = () => {
    if (papersLoading) return;
    dispatch(world, { type: 'resumeRound' });
    onStartQuiz();
  };

  const handleDiscardSaved = () => {
    dispatch(world, { type: 'discardSavedRound' });
  };

  const handleMissionClick = (index: number) => {
    if (papersLoading) return;
    const mission = missions[index];
    if (!mission) return;
    dispatch(world, { type: 'startRound', config: mission.config });
    onStartQuiz();
  };

  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const handleCheckUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateNote(null);
    const result = await checkForUpdateNow();
    if (result === 'new') {
      setUpdateNote('找到新版本，正在更新…');
      window.location.reload();
      return;
    }
    setUpdateNote(result === 'latest' ? '已經是最新版了' : '現在連不上網路，晚點再試');
    setCheckingUpdate(false);
  };

  const handleStampTap = (idx: number) => {
    setWobbleState((prev) => ({ idx, tick: (prev?.tick ?? 0) + 1 }));
  };

  const handleToastDismiss = () => {
    if (queuedUnlock) {
      setToastMessage(`解鎖新配件：${queuedUnlock}`);
      setQueuedUnlock(null);
    } else {
      setToastMessage(null);
    }
  };

  return (
    <div className="cb-stack">
      <Toast message={toastMessage} onDismiss={handleToastDismiss} />

      {showStampAnim && (
        <div className="cb-daily-stamp-overlay" aria-hidden="true">
          <div className="cb-stamp">今日達成</div>
        </div>
      )}

      <header className="cb-page-head">
        <h1>今日</h1>
        <Segmented
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={handleThemeChange}
          ariaLabel="畫面主題模式"
        />
      </header>

      {!papersLoading && savedRound && (
        <Card tone="butter" className="cb-stack-sm">
          <div className="cb-row">
            <Cat size={54} mood="idle" outfit={outfit} interactive />
            <div className="cb-grow">
              <strong className="cb-resume-title">
                {savedRound.study === 'read'
                  ? `上次刷到第 ${savedRound.pass} 遍・第 ${savedRound.current} / ${savedRound.total} 題，要繼續嗎？`
                  : `上次刷到第 ${savedRound.current} / ${savedRound.total} 題，要繼續嗎？`}
              </strong>
            </div>
          </div>
          <div className="cb-acts">
            <Button variant="ghost" onClick={handleDiscardSaved}>
              不用了
            </Button>
            <Button variant="primary" onClick={handleResumeSaved}>
              繼續
            </Button>
          </div>
        </Card>
      )}

      {bank ? (
        <>
          <Card tone="pink" className="cb-countdown" data-cat-perch="" data-cat-burn="today-countdown">
            <CatHome size={76}>
              <Cat
                size={76}
                mood={papersLoading ? 'sleepy' : 'idle'}
                outfit={outfit}
                interactive
              />
            </CatHome>
            <div className="cb-grow">
              <div className="cb-sub-strong">{bank.title}・距離筆試</div>
              <div className="cb-countdown-num">
                <b>{remainingDays}</b> 天
              </div>
              <div className="cb-sub-strong">考試日 {formatExamDate(bank.examDate)}</div>
            </div>
          </Card>

          {papersLoading ? (
            <Card className="cb-totals-card">
              <div className="cb-totals-text">題庫載入中…</div>
              <div className="cb-sub">正在準備歷屆試題</div>
            </Card>
          ) : loadError ? (
            <Card className="cb-totals-card">
              <div className="cb-totals-text">題庫載入失敗</div>
              <div className="cb-sub">請重新整理頁面再試</div>
            </Card>
          ) : (
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
          )}

          {sync.status === 'error' && onGoStamps && (
            <Card className="cb-sync-banner" onClick={onGoStamps}>
              <div className="cb-grow">
                <strong className="cb-install-banner-title">進度同步暫時出了問題</strong>
                <span className="cb-sub cb-block">{sync.error ?? '點這裡前往同步與備份查看'}</span>
              </div>
              <span className="cb-go">前往</span>
            </Card>
          )}

          {showInstallHint && onOpenInstallHint && (
            <Card tone="butter" className="cb-install-banner" onClick={onOpenInstallHint}>
              <div className="cb-grow">
                <strong className="cb-install-banner-title">加到主畫面，保留刷題進度</strong>
                <span className="cb-sub cb-block">避免 Safari 自動清除本機紀錄</span>
              </div>
              <span className="cb-go">查看</span>
            </Card>
          )}

          {onGoCat && !papersLoading ? (
            <Card tone="butter" className="cb-wd-today-card" onClick={onGoCat} data-cat-perch="" data-cat-burn="today-quest">
              <span className="cb-wd-quest-tag">今日任務</span>
              <span className="cb-grow cb-wd-today-text">
                {quest
                  ? quest.done
                    ? '完成了！去幫小貓換裝'
                    : `${quest.quest.name}・+${quest.quest.fish}`
                  : '去小貓衣櫥看看'}
              </span>
              <span className="cb-fish-pill cb-fish-pill-sm" aria-label={`小魚乾 ${fish.balance} 條`}>
                <FishIcon size={16} />
                <b className="cb-num-tabular">{fish.balance}</b>
              </span>
            </Card>
          ) : null}

          <section className="cb-section">
            <div className="cb-mission-head">
              <h2>今天的 3 個小任務</h2>
              <span className="cb-sub-strong cb-num-tabular">
                今天 {today.count} / {today.goal} 題
              </span>
            </div>
            <div
              className="cb-daily-paws"
              role="img"
              aria-label={`今日已完成 ${today.missionsDone} / ${today.missionsTotal} 個小任務`}
            >
              {Array.from({ length: today.missionsTotal }, (_, idx) => {
                const lit = idx < today.missionsDone;
                return (
                  <span
                    key={idx}
                    className={`cb-daily-paw ${lit ? 'is-lit' : ''}`.trim()}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24">
                      <ellipse cx="12" cy="16" rx="6" ry="4.6" />
                      <circle cx="5.5" cy="10" r="2.4" />
                      <circle cx="12" cy="7" r="2.6" />
                      <circle cx="18.5" cy="10" r="2.4" />
                    </svg>
                  </span>
                );
              })}
            </div>
            {papersLoading ? (
              <div className="cb-stack-sm">
                {bank.subjects.slice(0, 2).map((subj, idx) => (
                  <Card
                    key={subj.key}
                    className="cb-mission"
                    onClick={() => {}}
                    disabled
                  >
                    <span
                      className={`cb-dot cb-tone-${idx === 0 ? 'butter' : 'mint'}`}
                      aria-hidden="true"
                    >
                      {subj.short.slice(0, 1) || '題'}
                    </span>
                    <span className="cb-grow">
                      <strong className="cb-mission-title">{subj.short} 5 題</strong>
                      <span className="cb-sub cb-block">題庫載入中…</span>
                    </span>
                    <span className="cb-go">開始</span>
                  </Card>
                ))}
                <Card className="cb-mission" onClick={() => {}} disabled>
                  <span className="cb-dot cb-tone-pink" aria-hidden="true">
                    綜
                  </span>
                  <span className="cb-grow">
                    <strong className="cb-mission-title">綜合快刷 5 題</strong>
                    <span className="cb-sub cb-block">題庫載入中…</span>
                  </span>
                  <span className="cb-go">開始</span>
                </Card>
              </div>
            ) : missions.length > 0 ? (
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
            <p className="cb-sub cb-m0 cb-daily-goal-note">
              {today.stamped
                ? '今天的章蓋好了！'
                : `三個任務都做完（${DAILY_GOAL_QUESTIONS} 題）才會蓋今天的章`}
            </p>
          </section>

          <section className="cb-section">
            <h2>這週的章</h2>
            <div className="cb-week">
              {week.map((day, idx) => {
                const isWobbling = wobbleState?.idx === idx;
                const text = day.stamped
                  ? '完成'
                  : day.isToday
                    ? `${day.count}/${DAILY_GOAL_QUESTIONS}`
                    : day.label;
                return (
                  <button
                    key={isWobbling ? `${day.date}-${wobbleState.tick}` : day.date}
                    type="button"
                    className={[
                      'cb-week-stamp',
                      day.stamped ? 'is-on' : '',
                      day.isToday ? 'is-today' : '',
                      isWobbling ? 'is-wobbling' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleStampTap(idx)}
                    aria-label={`${day.date} 週${day.label}${day.stamped ? ' 已蓋章' : day.isToday ? ` 今天 ${day.count}/${DAILY_GOAL_QUESTIONS} 題` : ''}`}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </section>

          <Card className="cb-row cb-switch-card">
            <div className="cb-grow">
              <strong className="cb-block">音效</strong>
              <span className="cb-sub">按鈕、答題的聲音和小貓叫；手機靜音時不會響</span>
            </div>
            <Switch
              checked={soundOn(world)}
              onChange={(on) => dispatch(world, { type: 'setSound', on })}
              ariaLabel="音效"
            />
          </Card>

          <Card className="cb-stack-sm">
            <div className="cb-row cb-switch-card">
              <div className="cb-grow">
                <strong className="cb-block">天氣天空</strong>
                <span className="cb-sub">{weatherNote(weatherOn(world), weather, weatherPlace(world)?.name ?? null)}</span>
              </div>
              <Switch
                checked={weatherOn(world)}
                onChange={(on) => dispatch(world, { type: 'setWeather', on })}
                ariaLabel="天氣天空"
              />
            </div>
            {weatherOn(world) ? (
              <div className="cb-row cb-wrap cb-weather-row">
                <label className="cb-row cb-weather-place">
                  <span className="cb-sub">地點</span>
                  <select
                    className="cb-select"
                    value={weatherPlace(world)?.id ?? ''}
                    onChange={(ev) => dispatch(world, { type: 'setWeatherPlace', place: ev.target.value || null })}
                  >
                    <option value="">用定位</option>
                    {WEATHER_PLACES.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name}
                      </option>
                    ))}
                  </select>
                </label>
                {weather && WEATHER_RETRY[weather.status] ? (
                  <Chip tone="butter" onClick={weather.refresh}>
                    {WEATHER_RETRY[weather.status]}
                  </Chip>
                ) : null}
              </div>
            ) : null}
          </Card>

          <section className="cb-section cb-update-row">
            <Button variant="ghost" onClick={() => void handleCheckUpdate()} disabled={checkingUpdate}>
              {checkingUpdate ? '檢查中…' : '檢查更新'}
            </Button>
            {onOpenChangelog ? (
              <Button variant="ghost" onClick={onOpenChangelog}>
                更新紀錄
              </Button>
            ) : null}
            <span className="cb-sub" role="status">
              {updateNote ?? (getCurrentAppVersion() ? `版本 ${formatAppVersion(getCurrentAppVersion())}` : '')}
            </span>
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
