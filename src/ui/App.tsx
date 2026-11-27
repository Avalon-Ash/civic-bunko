import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatch } from '../core/commands';
import { ACCESSORIES, DAILY_GOAL_QUESTIONS, STAMPS_PER_REWARD } from '../core/constants/daily';
import type { ChangelogEntry, DayKey, GuidePreset, GuideTarget, TabId } from '../core/types';
import type { World } from '../core/world';
import { currentQuestion, getSettings, readView, roundSummary, type RoundSummaryView } from '../selectors';
import { isInstallHintDismissed } from '../selectors/backup';
import { stampTotals, todayProgress } from '../selectors/daily';
import { leaderCat, outingCats } from '../selectors/house';
import { toLocalDateString } from '../systems/date';
import { InstallHintSheet } from './components/InstallHintSheet';
import { UpdateBanner } from './components/UpdateBanner';
import { TabBar } from './kit/TabBar';
import { GuideProvider, planGo, useGuideLanding, type GuideRequest } from './useGuide';
import { Toast } from './kit/Toast';
import { isStandaloneApp } from './platform';
import { CardsScreen } from './screens/CardsScreen';
import { DrillSetupScreen } from './screens/DrillSetupScreen';
import { QuestionScreen } from './screens/QuestionScreen';
import { ReadScreen } from './screens/ReadScreen';
import { ResultScreen } from './screens/ResultScreen';
import { StampsScreen } from './screens/StampsScreen';
import { WardrobeScreen } from './screens/WardrobeScreen';
import { RewardToast } from './components/RewardToast';
import { ChangelogSheet } from './components/ChangelogSheet';
import { useSoundEffects } from './useSoundEffects';
import { CatVoiceProvider } from './pet/CatVoiceProvider';
import { PetLayer } from './pet/PetLayer';
import { ScorchLayer } from './pet/ScorchLayer';
import { Sky } from './kit/Sky';
import { useWeather } from './useWeather';
import { weatherOn, weatherPlace } from '../selectors/weather';
import { CHANGELOG } from '../core/constants/changelog';
import { latestChangelog, unseenChangelog } from '../selectors/changelog';
import { TodayScreen, type StampCelebration } from './screens/TodayScreen';
import { useAppVersion } from './useAppVersion';
import { useWorld } from './useWorld';
import { LevelProvider, type LevelApi, type LevelState, type LevelStep } from './useLevel';

export interface AppProps {
  world: World;
  papersLoading?: boolean;
  loadError?: boolean;
}

/** 應用程式外殼：管理四個分頁、套用主題到 <html data-theme>、協調刷題流程與安裝引導。 */
export function App({ world, papersLoading = false, loadError = false }: AppProps) {
  useWorld(world);
  useSoundEffects(world);
  const hasUpdate = useAppVersion();

  const [tab, setTab] = useState<TabId>('today');
  const [showResult, setShowResult] = useState(false);
  // 圖卡闖關：開著哪一關、目前的回合是不是從關卡開的（只在記憶體；docs/plans/level-mode.md §4）
  const [level, setLevel] = useState<LevelState | null>(null);
  const [quizCardId, setQuizCardId] = useState<string | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const standalone = isStandaloneApp();
  const dismissed = isInstallHintDismissed(world);
  const showInstallHint = !standalone && !dismissed;

  const [installSheetOpen, setInstallSheetOpen] = useState<boolean>(
    () => !isStandaloneApp() && !isInstallHintDismissed(world),
  );
  const [pendingCelebration, setPendingCelebration] = useState<StampCelebration | null>(null);
  const [examToast, setExamToast] = useState<string | null>(null);
  // 更新紀錄：更新後第一次打開自動跳出沒看過的；今日頁也能打開全部。列表在打開時就固定，關閉動畫期間不會變空。
  const [changelog, setChangelog] = useState<{ title: string; entries: ChangelogEntry[] } | null>(() => {
    if (!isStandaloneApp() && !isInstallHintDismissed(world)) return null;
    const unseen = unseenChangelog(world);
    return unseen.length > 0 ? { title: '更新了什麼', entries: unseen } : null;
  });
  const [changelogOpen, setChangelogOpen] = useState(changelog !== null);
  const openAllChangelog = () => {
    setChangelog({ title: '更新紀錄', entries: [...CHANGELOG] });
    setChangelogOpen(true);
  };
  const closeChangelog = () => {
    setChangelogOpen(false);
    const latest = latestChangelog();
    if (latest) dispatch(world, { type: 'markChangelogSeen', id: latest.id });
  };

  const settings = getSettings(world);
  // 天氣天空：她在今日頁打開之後才會問定位
  const sky = useWeather(weatherOn(world), weatherPlace(world));
  const questionView = currentQuestion(world);
  const readQuestion = readView(world);
  const summary = roundSummary(world);
  const hasActiveRound = questionView !== null || readQuestion !== null;

  const wasInRoundRef = useRef(false);
  const entrySummaryRef = useRef<RoundSummaryView | null>(summary);
  const mainRef = useRef<HTMLElement | null>(null);
  const prevTodayRef = useRef<{ day: DayKey; count: number }>({
    day: toLocalDateString(new Date()),
    count: todayProgress(world, new Date()).count,
  });
  const celebratedDaysRef = useRef(new Set<DayKey>());

  // 偵測當天第一次達到每日目標（14 -> 15），僅觸發一次慶祝與配件解鎖提示
  useEffect(() => {
    const syncBaseline = () => {
      const nowDate = new Date();
      const todayKey = toLocalDateString(nowDate);
      const count = todayProgress(world, nowDate).count;
      prevTodayRef.current = { day: todayKey, count };
    };
    syncBaseline();

    const unsubProgress = world.bus.on('progressChanged', syncBaseline);
    const unsubDayLog = world.bus.on('dayLogChanged', (event) => {
      const todayKey = toLocalDateString(new Date());
      if (event.day !== todayKey) return;

      const prevCount = prevTodayRef.current.day === todayKey ? prevTodayRef.current.count : 0;
      prevTodayRef.current = { day: todayKey, count: event.count };

      if (
        prevCount < DAILY_GOAL_QUESTIONS &&
        event.count >= DAILY_GOAL_QUESTIONS &&
        !celebratedDaysRef.current.has(todayKey)
      ) {
        celebratedDaysRef.current.add(todayKey);
        const { total } = stampTotals(world);
        let unlockedName: string | null = null;
        if (total > 0 && total % STAMPS_PER_REWARD === 0) {
          const acc = ACCESSORIES[total / STAMPS_PER_REWARD - 1];
          unlockedName = acc ? acc.name : null;
        }
        setPendingCelebration({ day: todayKey, unlockedName });
      }
    });

    return () => {
      unsubProgress();
      unsubDayLog();
    };
  }, [world]);

  const handleCelebrationDone = useCallback(() => {
    setPendingCelebration(null);
  }, []);

  const handleExamTimeout = useCallback(() => {
    setExamToast('時間到，已交卷');
  }, []);

  useEffect(() => {
    if (!showInstallHint) {
      setInstallSheetOpen(false);
    }
  }, [showInstallHint]);

  // 套用主題到 <html data-theme>；system 時移除屬性以跟隨系統
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', settings.theme);
    }
  }, [settings.theme]);

  // 偵測回合結束或放棄，決定是否切換至結果頁（依 roundSummary 物件是否更新判斷）
  useEffect(() => {
    if (hasActiveRound) {
      if (!wasInRoundRef.current) {
        entrySummaryRef.current = summary;
      }
      wasInRoundRef.current = true;
      setShowResult(false);
      return;
    }

    if (wasInRoundRef.current) {
      wasInRoundRef.current = false;
      // 關卡裡答完：成績在關卡的第 3 步看，刷題頁不跳結果頁（在刷題頁答完的照常跳）
      const levelOwnsResult = quizCardId !== null && tabRef.current === 'cards';
      setQuizCardId(null);
      if (summary !== null && summary !== entrySummaryRef.current && !levelOwnsResult) {
        setShowResult(true);
      } else {
        setShowResult(false);
      }
    }
  }, [hasActiveRound, summary, quizCardId]);

  const quizStage = questionView
    ? 'question'
    : readQuestion
      ? 'read'
      : showResult
        ? 'result'
        : 'setup';

  const activeQuestionKey = questionView
    ? questionView.question.id
    : readQuestion
      ? `${readQuestion.pass}-${readQuestion.index}-${readQuestion.question.id}`
      : undefined;

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [tab, quizStage, activeQuestionKey, level?.cardId, level?.step]);

  // 引導：畫面只經 go() 換頁與落點（ADR 0019）。go 要穩定，回合與結果頁的狀態從 ref 讀。
  const [guide, setGuide] = useState<GuideRequest | null>(null);
  const guideSeqRef = useRef(0);
  const guideTakenRef = useRef(new Set<number>());
  const guideRef = useRef(guide);
  guideRef.current = guide;
  const goStateRef = useRef({ hasActiveRound, showResult });
  goStateRef.current = { hasActiveRound, showResult };
  const go = useCallback((target: GuideTarget) => {
    const plan = planGo(target, goStateRef.current);
    if (plan.closeResult) setShowResult(false);
    // 引導到圖卡頁的落點在列表上：先關掉開著的關卡
    if (plan.tab === 'cards') setLevel(null);
    setTab(plan.tab);
    guideSeqRef.current += 1;
    setGuide(plan.land ? { target: plan.land, seq: guideSeqRef.current } : null);
  }, []);
  const takePreset = useCallback((preset: GuidePreset) => {
    const current = guideRef.current;
    if (!current || current.target.preset !== preset || guideTakenRef.current.has(current.seq)) return false;
    guideTakenRef.current.add(current.seq);
    return true;
  }, []);
  // 要排在上面「換頁捲回頂端」之後：同一次畫面更新裡先捲回頂端，再捲到落點
  useGuideLanding(guide);

  const handleTabSelect = (nextTab: TabId) => {
    setGuide(null);
    if (nextTab === 'quiz' && !hasActiveRound && showResult) {
      setShowResult(false);
    }
    setTab(nextTab);
  };

  const levelApi: LevelApi = {
    level,
    open: (cardId: string, step: LevelStep = 'look') => setLevel({ cardId, step }),
    setStep: (step: LevelStep) => setLevel((prev) => (prev ? { ...prev, step } : prev)),
    close: () => setLevel(null),
    startQuiz: (cardId: string) => {
      dispatch(world, { type: 'startCardRound', cardId });
      setQuizCardId(cardId);
    },
    quizCardId,
  };

  const renderMain = () => {
    switch (tab) {
      case 'today':
        return (
          <TodayScreen
            world={world}
            papersLoading={papersLoading}
            loadError={loadError}
            showInstallHint={showInstallHint}
            weather={sky}
            onOpenInstallHint={() => setInstallSheetOpen(true)}
            celebration={pendingCelebration}
            onCelebrationDone={handleCelebrationDone}
            onStartQuiz={() => setTab('quiz')}
            onGoSetup={() => {
              setShowResult(false);
              setTab('quiz');
            }}
            onGoStamps={() => setTab('stamps')}
            onGoCat={() => setTab('cat')}
            onOpenChangelog={openAllChangelog}
          />
        );
      case 'cards':
        return <CardsScreen world={world} />;
      case 'cat':
        return <WardrobeScreen world={world} />;
      case 'stamps':
        return (
          <StampsScreen
            world={world}
            papersLoading={papersLoading}
            onStartQuiz={() => setTab('quiz')}
            onGoCat={() => setTab('cat')}
          />
        );
      case 'quiz':
        if (questionView) {
          return <QuestionScreen world={world} onExamTimeout={handleExamTimeout} />;
        }
        if (readQuestion) {
          return <ReadScreen world={world} />;
        }
        if (showResult) {
          return (
            <ResultScreen
              world={world}
              onAgain={() => setShowResult(false)}
              onHome={() => {
                setShowResult(false);
                setTab('today');
              }}
            />
          );
        }
        return <DrillSetupScreen world={world} papersLoading={papersLoading} />;
    }
  };

  const isWideContent = tab === 'quiz' && hasActiveRound;
  const petTab = hasActiveRound ? 'round' : tab;
  const activePets = petTab === 'round' ? [leaderCat(world)] : outingCats(world);

  return (
    <CatVoiceProvider world={world}>
      <GuideProvider value={{ go, request: guide, takePreset }}>
      <LevelProvider value={levelApi}>
      <div className="cb-shell">
        <Toast message={examToast} onDismiss={() => setExamToast(null)} />
        <RewardToast world={world} />
        {/* 答題中不畫：讓她專心 */}
        <Sky weather={hasActiveRound ? null : sky.weather} />
        <ScorchLayer world={world} />
        {activePets.map((cat) => (
          <PetLayer key={cat} world={world} cat={cat} tab={petTab} allowed={!world.round?.config.exam} />
        ))}
        <TabBar active={tab} onSelect={handleTabSelect} />
        <main
          ref={mainRef}
          className={`cb-main ${isWideContent ? 'is-wide' : ''}`.trim()}
        >
          {hasUpdate && <UpdateBanner onReload={() => window.location.reload()} />}
          <div className="cb-container">{renderMain()}</div>
        </main>
        {changelog ? (
          <ChangelogSheet
            open={changelogOpen}
            title={changelog.title}
            entries={changelog.entries}
            onClose={closeChangelog}
          />
        ) : null}
        {showInstallHint && (
          <InstallHintSheet
            open={installSheetOpen}
            onLater={() => setInstallSheetOpen(false)}
            onDismissForever={() => {
              dispatch(world, { type: 'dismissInstallHint' });
              setInstallSheetOpen(false);
            }}
          />
        )}
      </div>
      </LevelProvider>
      </GuideProvider>
    </CatVoiceProvider>
  );
}
