import { useEffect, useRef, useState } from 'react';
import { dispatch } from '../core/commands';
import type { World } from '../core/world';
import { currentQuestion, getSettings, roundSummary } from '../selectors';
import { isInstallHintDismissed } from '../selectors/backup';
import { InstallHintSheet } from './components/InstallHintSheet';
import { TabBar, type TabId } from './kit/TabBar';
import { isStandaloneApp } from './platform';
import { CardsScreen } from './screens/CardsScreen';
import { DrillSetupScreen } from './screens/DrillSetupScreen';
import { QuestionScreen } from './screens/QuestionScreen';
import { ResultScreen } from './screens/ResultScreen';
import { StampsScreen } from './screens/StampsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { useWorld } from './useWorld';

export interface AppProps {
  world: World;
  papersLoading?: boolean;
  loadError?: boolean;
}

/** 應用程式外殼：管理四個分頁、套用主題到 <html data-theme>、協調刷題流程與安裝引導。 */
export function App({ world, papersLoading = false, loadError = false }: AppProps) {
  useWorld(world);

  const [tab, setTab] = useState<TabId>('today');
  const [showResult, setShowResult] = useState(false);

  const standalone = isStandaloneApp();
  const dismissed = isInstallHintDismissed(world);
  const showInstallHint = !standalone && !dismissed;

  const [installSheetOpen, setInstallSheetOpen] = useState<boolean>(
    () => !isStandaloneApp() && !isInstallHintDismissed(world),
  );

  const settings = getSettings(world);
  const questionView = currentQuestion(world);
  const summary = roundSummary(world);

  const prevRoundRef = useRef<{ answered: boolean } | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

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

  // 偵測回合結束或放棄，決定是否切換至結果頁
  useEffect(() => {
    if (questionView) {
      setShowResult(false);
      prevRoundRef.current = {
        answered: questionView.index > 0 || questionView.pick !== null,
      };
      return;
    }

    if (prevRoundRef.current) {
      const wasAnswered = prevRoundRef.current.answered;
      prevRoundRef.current = null;
      if (wasAnswered && summary) {
        setShowResult(true);
      } else {
        setShowResult(false);
      }
    }
  }, [questionView, summary]);

  const quizStage = questionView ? 'question' : showResult ? 'result' : 'setup';

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [tab, quizStage, questionView?.question.id]);

  const handleTabSelect = (nextTab: TabId) => {
    if (nextTab === 'quiz' && !questionView && showResult) {
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
            onStartQuiz={() => setTab('quiz')}
            onGoSetup={() => {
              setShowResult(false);
              setTab('quiz');
            }}
          />
        );
      case 'cards':
        return <CardsScreen />;
      case 'stamps':
        return <StampsScreen world={world} papersLoading={papersLoading} />;
      case 'quiz':
        if (questionView) {
          return <QuestionScreen world={world} />;
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

  const isWideContent = tab === 'quiz' && questionView !== null;

  return (
    <div className="cb-shell">
      <TabBar active={tab} onSelect={handleTabSelect} />
      <main
        ref={mainRef}
        className={`cb-main ${isWideContent ? 'is-wide' : ''}`.trim()}
      >
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
