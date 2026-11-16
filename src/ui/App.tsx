import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatch } from '../core/commands';
import { ACCESSORIES, DAILY_GOAL_QUESTIONS, STAMPS_PER_REWARD } from '../core/constants/daily';
import type { DayKey } from '../core/types';
import type { World } from '../core/world';
import { currentQuestion, getSettings, readView, roundSummary, type RoundSummaryView } from '../selectors';
import { isInstallHintDismissed } from '../selectors/backup';
import { stampTotals, todayProgress } from '../selectors/daily';
import { toLocalDateString } from '../systems/date';
import { InstallHintSheet } from './components/InstallHintSheet';
import { UpdateBanner } from './components/UpdateBanner';
import { TabBar, type TabId } from './kit/TabBar';
import { Toast } from './kit/Toast';
import { isStandaloneApp } from './platform';
import { CardsScreen } from './screens/CardsScreen';
import { DrillSetupScreen } from './screens/DrillSetupScreen';
import { QuestionScreen } from './screens/QuestionScreen';
import { ReadScreen } from './screens/ReadScreen';
import { ResultScreen } from './screens/ResultScreen';
import { StampsScreen } from './screens/StampsScreen';
import { TodayScreen, type StampCelebration } from './screens/TodayScreen';
import { useAppVersion } from './useAppVersion';
import { useWorld } from './useWorld';

export interface AppProps {
  world: World;
  papersLoading?: boolean;
  loadError?: boolean;
}

/** 應用程式外殼：管理四個分頁、套用主題到 <html data-theme>、協調刷題流程與安裝引導。 */
export function App({ world, papersLoading = false, loadError = false }: AppProps) {
  useWorld(world);
  const hasUpdate = useAppVersion();

  const [tab, setTab] = useState<TabId>('today');
  const [showResult, setShowResult] = useState(false);

  const standalone = isStandaloneApp();
  const dismissed = isInstallHintDismissed(world);
  const showInstallHint = !standalone && !dismissed;

  const [installSheetOpen, setInstallSheetOpen] = useState<boolean>(
    () => !isStandaloneApp() && !isInstallHintDismissed(world),
  );
  const [pendingCelebration, setPendingCelebration] = useState<StampCelebration | null>(null);
  const [examToast, setExamToast] = useState<string | null>(null);

  const settings = getSettings(world);
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
      if (summary !== null && summary !== entrySummaryRef.current) {
        setShowResult(true);
      } else {
        setShowResult(false);
      }
    }
  }, [hasActiveRound, summary]);

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
  }, [tab, quizStage, activeQuestionKey]);

  const handleTabSelect = (nextTab: TabId) => {
    if (nextTab === 'quiz' && !hasActiveRound && showResult) {
      setShowResult(false);
    }
    setTab(nextTab);
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
            onOpenInstallHint={() => setInstallSheetOpen(true)}
            celebration={pendingCelebration}
            onCelebrationDone={handleCelebrationDone}
            onStartQuiz={() => setTab('quiz')}
            onGoSetup={() => {
              setShowResult(false);
              setTab('quiz');
            }}
            onGoStamps={() => setTab('stamps')}
          />
        );
      case 'cards':
        return <CardsScreen world={world} />;
      case 'stamps':
        return (
          <StampsScreen
            world={world}
            papersLoading={papersLoading}
            onStartQuiz={() => setTab('quiz')}
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

  return (
    <div className="cb-shell">
      <Toast message={examToast} onDismiss={() => setExamToast(null)} />
      <TabBar active={tab} onSelect={handleTabSelect} />
      <main
        ref={mainRef}
        className={`cb-main ${isWideContent ? 'is-wide' : ''}`.trim()}
      >
        {hasUpdate && <UpdateBanner onReload={() => window.location.reload()} />}
        <div className="cb-container">{renderMain()}</div>
      </main>
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
  );
}
