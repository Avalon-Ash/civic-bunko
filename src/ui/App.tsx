import { useEffect, useRef, useState } from 'react';
import type { World } from '../core/world';
import { currentQuestion, getSettings, roundSummary } from '../selectors';
import { TabBar, type TabId } from './kit/TabBar';
import { CardsScreen } from './screens/CardsScreen';
import { DrillSetupScreen } from './screens/DrillSetupScreen';
import { QuestionScreen } from './screens/QuestionScreen';
import { ResultScreen } from './screens/ResultScreen';
import { StampsScreen } from './screens/StampsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { useWorld } from './useWorld';

export interface AppProps {
  world: World;
}

/** 應用程式外殼：管理四個分頁、套用主題到 <html data-theme>、協調刷題流程畫面切換。 */
export function App({ world }: AppProps) {
  useWorld(world);

  const [tab, setTab] = useState<TabId>('today');
  const [showResult, setShowResult] = useState(false);

  const settings = getSettings(world);
  const questionView = currentQuestion(world);
  const summary = roundSummary(world);

  const prevRoundRef = useRef<{ answered: boolean } | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

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
        return <StampsScreen world={world} />;
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
        return <DrillSetupScreen world={world} />;
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
    </div>
  );
}
