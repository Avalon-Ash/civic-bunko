import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatch } from '../../core/commands';
import { FAST_ADVANCE_MS } from '../../core/constants/round';
import type { Choice, LawRef, TopicInfo } from '../../core/types';
import type { World } from '../../core/world';
import { formatLawRef } from '../../data/laws';
import { loadTopics } from '../../data/source';
import { resolveTopicLabel } from '../../data/sourceLoader';
import { currentQuestion, currentRoundConfig, questionPaper } from '../../selectors';
import { currentAccessory } from '../../selectors/daily';
import { examClock } from '../../selectors/exam';
import { LawArticlePanel, OptionExplainList } from '../components/OptionExplain';
import {
  CHOICES,
  CorrectionBox,
  EnrichCard,
  formatQuestionSource,
  MarkedStem,
  PassageCard,
  TEXT_MODE_OPTIONS,
} from '../components/QuestionParts';
import { Burst } from '../kit/Burst';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import { Dialog } from '../kit/Dialog';
import { ProgressBar } from '../kit/ProgressBar';
import { Segmented } from '../kit/Segmented';
import { Sheet } from '../kit/Sheet';
import { Toast } from '../kit/Toast';
import { useWorld } from '../useWorld';

const MILESTONE_COMBOS = new Set([5, 10, 20, 30]);
const EXAM_ADVANCE_MS = 220;
const EXAM_ADVANCE_REDUCED_MS = 80;

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface QuestionScreenProps {
  world: World;
  onExamTimeout?: () => void;
}

/** 作答畫面：進度條與小貓、題組文章收合、四色標記題幹、四個選項與粒子噴發、回饋卡與選項解析抽屜；模擬考模式改為倒數計時與無回饋連續作答。 */
export function QuestionScreen({ world, onExamTimeout }: QuestionScreenProps) {
  useWorld(world);
  const view = currentQuestion(world);
  const config = currentRoundConfig(world);
  const isExam = Boolean(config?.exam);

  const [textMode, setTextMode] = useState<'official' | 'plain'>('official');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeLawRef, setActiveLawRef] = useState<LawRef | null>(null);
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [burstChoice, setBurstChoice] = useState<{ choice: Choice; tick: number } | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [catSpin, setCatSpin] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const timedOutRef = useRef(false);

  const questionId = view?.question.id;
  const pick = view?.pick ?? null;
  const isCorrect = view?.isCorrect ?? null;
  const fast = !isExam && (config?.fast ?? false);
  const combo = view?.combo ?? 0;

  useEffect(() => {
    let active = true;
    loadTopics().then((list) => {
      if (active) {
        setTopics(list);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // 換題時重設原文／白話切換、抽屜與粒子狀態
  useEffect(() => {
    setTextMode('official');
    setSheetOpen(false);
    setActiveLawRef(null);
    setBurstChoice(null);
  }, [questionId]);

  // 模擬考每秒更新倒數
  useEffect(() => {
    if (!isExam) {
      timedOutRef.current = false;
      setSubmitDialogOpen(false);
      return undefined;
    }
    setNowTick(Date.now());
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [isExam]);

  const clock = isExam ? examClock(world, new Date(nowTick)) : null;

  // 時間到直接交卷
  useEffect(() => {
    if (!isExam || !clock?.expired || timedOutRef.current) {
      return;
    }
    timedOutRef.current = true;
    setSubmitDialogOpen(false);
    onExamTimeout?.();
    dispatch(world, { type: 'quitRound' });
  }, [isExam, clock?.expired, world, onExamTimeout]);

  // 模擬考選完選項後短暫標示再自動跳下一題
  useEffect(() => {
    if (!isExam || pick === null) {
      return undefined;
    }
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      dispatch(world, { type: 'next' });
    }, reduced ? EXAM_ADVANCE_REDUCED_MS : EXAM_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [isExam, world, questionId, pick]);

  // 連對里程碑横幅與貓咪轉圈（模擬考不觸發）
  const prevComboRef = useRef(0);
  useEffect(() => {
    if (isExam) {
      prevComboRef.current = 0;
      return undefined;
    }
    if (combo > prevComboRef.current && MILESTONE_COMBOS.has(combo)) {
      setMilestoneToast(`連對 ${combo}！`);
      setCatSpin(true);
      const timer = window.setTimeout(() => setCatSpin(false), 900);
      prevComboRef.current = combo;
      return () => window.clearTimeout(timer);
    }
    prevComboRef.current = combo;
    return undefined;
  }, [isExam, combo]);

  // 快刷模式且答對時，於 FAST_ADVANCE_MS 後自動前進下一題；換題或離開時清除計時器
  useEffect(() => {
    if (!fast || pick === null || isCorrect !== true) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      dispatch(world, { type: 'next' });
    }, FAST_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [world, fast, questionId, pick, isCorrect]);

  const handleBurstDone = useCallback(() => {
    setBurstChoice(null);
  }, []);

  if (!view) {
    return null;
  }

  const { question, group, enrich, index, total, optionOrder } = view;
  const paper = questionPaper(world, question.paperId);
  const accessory = currentAccessory(world);
  const isAnswered = pick !== null;

  const sourceLabel = formatQuestionSource(paper, question.no);
  const firstTopic = enrich?.topic[0];
  const topicLabel = isExam
    ? (paper?.subjectName ?? '模擬考')
    : firstTopic
      ? resolveTopicLabel(topics, firstTopic)
      : (paper?.subjectName ?? '題目');

  const answeredCount = index + (isAnswered ? 1 : 0);
  const unansweredCount = Math.max(0, total - answeredCount);

  const handlePick = (choice: Choice) => {
    if (isAnswered) return;
    if (isExam) {
      dispatch(world, { type: 'answer', pick: choice });
      return;
    }
    const correct = question.answer.includes(choice);
    if (correct) {
      setBurstChoice((prev) => ({ choice, tick: (prev?.tick ?? 0) + 1 }));
    }
    dispatch(world, { type: 'answer', pick: choice });
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      feedbackRef.current?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });
  };

  const handleNext = () => {
    if (!isAnswered) return;
    dispatch(world, { type: 'next' });
  };

  const handleQuit = () => {
    dispatch(world, { type: 'quitRound' });
  };

  const handleConfirmSubmit = () => {
    setSubmitDialogOpen(false);
    dispatch(world, { type: 'quitRound' });
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isExam) return;
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isExam || !isAnswered || sheetOpen || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (dx < -70 && Math.abs(dy) < 50) {
      handleNext();
    }
  };

  const showCompactFastFeedback = Boolean(!isExam && enrich && fast && isCorrect);
  const countdownText = formatCountdown(clock?.remainingSeconds ?? 0);

  return (
    <div
      className="cb-question-layout"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {!isExam && (
        <Toast message={milestoneToast} onDismiss={() => setMilestoneToast(null)} />
      )}

      {isExam ? (
        <div className="cb-q-topbar cb-exam-topbar">
          <span
            className={`cb-chip cb-exam-timer cb-num-tabular ${clock?.warn ? 'is-warn' : 'cb-chip-plain'}`.trim()}
            aria-label={`剩餘時間 ${countdownText}`}
          >
            {countdownText}
          </span>
          <span className="cb-q-counter cb-exam-counter">
            第 <b>{index + 1}</b> / {total} 題
          </span>
          <Chip tone="butter" onClick={() => setSubmitDialogOpen(true)}>
            交卷
          </Chip>
        </div>
      ) : (
        <div className="cb-q-topbar">
          <ProgressBar
            value={index + (isAnswered ? 1 : 0)}
            total={total}
            showCat
            ariaLabel={`第 ${index + 1} 題，共 ${total} 題`}
            className="cb-grow"
          />
          <span className="cb-q-counter">
            <b>{index + 1}</b> / {total}
          </span>
          {combo > 1 && <Chip tone="butter">連對 {combo}</Chip>}
          <Chip tone="plain" onClick={handleQuit}>
            結束
          </Chip>
        </div>
      )}

      <div className="cb-q-stem-col">
        <div className="cb-row cb-wrap">
          <Chip tone="butter">{topicLabel}</Chip>
          {!isExam && question.correction && <Chip tone="orange">官方更正</Chip>}
          {!isExam && enrich?.plain && (
            <Segmented
              options={TEXT_MODE_OPTIONS}
              value={textMode}
              onChange={setTextMode}
              ariaLabel="題目版本切換"
              className="cb-ml-auto"
            />
          )}
        </div>

        {group && <PassageCard group={group} />}

        <p className="cb-stem">
          {!isExam && textMode === 'plain' && enrich?.plain ? (
            enrich.plain
          ) : isExam ? (
            question.stem
          ) : (
            <MarkedStem stem={question.stem} marks={enrich?.marks ?? []} />
          )}
        </p>

        <div className="cb-mt-sm">
          <Chip tone="plain">{sourceLabel}</Chip>
        </div>

        {!isExam && isAnswered && question.correction && (
          <CorrectionBox correction={question.correction} />
        )}
      </div>

      <div className="cb-q-opts-col">
        <div className="cb-opts">
          {optionOrder.map((choice) => {
            const idx = CHOICES.indexOf(choice);
            const optText = question.options[idx] ?? '';
            const isChoiceRight = question.answer.includes(choice);
            const isPickedWrong = isAnswered && pick === choice && !isChoiceRight;
            const isDimmed = isAnswered && !isChoiceRight && pick !== choice;

            const stateClass = isExam
              ? isAnswered && pick === choice
                ? 'is-exam-picked'
                : ''
              : isAnswered
                ? isChoiceRight
                  ? 'is-right'
                  : isPickedWrong
                    ? 'is-picked'
                    : isDimmed
                      ? 'is-dim'
                      : ''
                : '';

            const showBurst = !isExam && burstChoice?.choice === choice;

            return (
              <div key={choice} className="cb-opt-wrap">
                <button
                  type="button"
                  className={`cb-card cb-press cb-opt ${stateClass}`.trim()}
                  disabled={isAnswered}
                  onClick={() => handlePick(choice)}
                >
                  <span className="cb-opt-key">{choice}</span>
                  <span className="cb-grow">{optText}</span>
                </button>
                {showBurst && <Burst key={burstChoice.tick} onDone={handleBurstDone} />}
              </div>
            );
          })}
        </div>

        {!isExam && isAnswered && (
          <div ref={feedbackRef} className="cb-stack-sm cb-mt-md">
            {showCompactFastFeedback && enrich ? (
              <Card tone="green" className="cb-kou cb-kou-compact">
                <div className="cb-row">
                  <Cat size={58} mood="yay" spin={catSpin} accessory={accessory} interactive />
                  <div className="cb-grow">
                    <div className="cb-kou-head">
                      <small>答對！</small>
                      {!enrich.reviewed && <span className="cb-ai-tag">AI 解析</span>}
                    </div>
                    <b className="cb-kou-mnemonic">{enrich.mnemonic}</b>
                  </div>
                </div>
              </Card>
            ) : enrich ? (
              <>
                <EnrichCard
                  enrich={enrich}
                  tone={isCorrect ? 'green' : 'butter'}
                  className={isCorrect ? '' : 'is-miss'}
                  catMood={isCorrect ? 'yay' : 'oops'}
                  catSpin={catSpin}
                  catAccessory={accessory}
                  label={
                    <small>{isCorrect ? '答對了！口訣再記一次' : '差一點！看這句馬上學會'}</small>
                  }
                />
                <div className="cb-acts">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActiveLawRef(null);
                      setSheetOpen(true);
                    }}
                  >
                    看每個選項
                  </Button>
                  <Button onClick={handleNext}>
                    {index + 1 === total ? '蓋章' : '下一題'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Card tone={isCorrect ? 'green' : 'butter'} className={`cb-kou ${isCorrect ? '' : 'is-miss'}`}>
                  <div className="cb-row">
                    <Cat
                      size={58}
                      mood={isCorrect ? 'yay' : 'oops'}
                      spin={catSpin}
                      accessory={accessory}
                      interactive
                    />
                    <div className="cb-grow">
                      <small>{isCorrect ? '答對了！' : '差一點！'}</small>
                      <b className="cb-kou-mnemonic">
                        正解是 ({question.answer.join('、')})
                      </b>
                      <div className="cb-sub-strong">口訣準備中</div>
                    </div>
                  </div>
                </Card>
                {!fast || !isCorrect ? (
                  <div className="cb-acts">
                    <Button onClick={handleNext}>
                      {index + 1 === total ? '蓋章' : '下一題'}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {!isExam && enrich && (
        <Sheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            setActiveLawRef(null);
          }}
          title={activeLawRef ? formatLawRef(activeLawRef) : '每個選項的說明'}
        >
          {activeLawRef ? (
            <LawArticlePanel lawRef={activeLawRef} onBack={() => setActiveLawRef(null)} />
          ) : (
            <OptionExplainList
              question={question}
              enrich={enrich}
              onSelectLaw={setActiveLawRef}
            />
          )}
        </Sheet>
      )}

      {isExam && (
        <Dialog
          open={submitDialogOpen}
          onClose={() => setSubmitDialogOpen(false)}
          title="確定要交卷嗎？"
        >
          <div className="cb-stack-sm">
            <p className="cb-m0">
              {answeredCount === 0
                ? `還有 ${unansweredCount} 題沒寫。一題都沒寫就交卷，會直接離開這次模擬考。`
                : unansweredCount > 0
                  ? `還有 ${unansweredCount} 題沒寫，現在交卷只會計算已作答的題目。`
                  : '全部題目都寫完了，確定現在交卷嗎？'}
            </p>
            <div className="cb-acts">
              <Button variant="ghost" onClick={() => setSubmitDialogOpen(false)}>
                繼續作答
              </Button>
              <Button variant="primary" onClick={handleConfirmSubmit}>
                確認交卷
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
