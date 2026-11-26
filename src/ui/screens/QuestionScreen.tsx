import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatch } from '../../core/commands';
import { FAST_ADVANCE_MS } from '../../core/constants/round';
import type { Choice, LawRef, TopicInfo } from '../../core/types';
import type { World } from '../../core/world';
import { formatLawRef } from '../../data/laws';
import { loadTopics } from '../../data/source';
import { resolveTopicLabel } from '../../data/sourceLoader';
import { bilingualOn, currentQuestion, currentRoundConfig, paperSubjectName, questionPaper } from '../../selectors';
import { catOutfit, leaderCat } from '../../selectors/house';
import { examClock, examSheet } from '../../selectors/exam';
import {
  BilingualToggle,
  OptionTextWithZh,
  OptionZhToggleButton,
  QuestionVocabCard,
  StemTranslation,
} from '../components/Bilingual';
import { LawArticlePanel, OptionExplainList } from '../components/OptionExplain';
import { CardLinks } from '../components/cards/CardLinks';
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
import { PetRunner } from '../pet/PetRunner';
import { CAT_CHOICE_ATTR, useCatHint } from '../pet/useCatHint';
import { Segmented } from '../kit/Segmented';
import { Sheet } from '../kit/Sheet';
import { Toast } from '../kit/Toast';
import { useWorld } from '../useWorld';

const MILESTONE_COMBOS = new Set([5, 10, 20, 30]);
const EXAM_ADVANCE_MS = 400;

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
  const [showOptionZh, setShowOptionZh] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeLawRef, setActiveLawRef] = useState<LawRef | null>(null);
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [burstChoice, setBurstChoice] = useState<{ choice: Choice; tick: number } | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [catSpin, setCatSpin] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [examNavOpen, setExamNavOpen] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const timedOutRef = useRef(false);
  const examAdvanceTimerRef = useRef<number | null>(null);

  const clearExamAdvanceTimer = useCallback(() => {
    if (examAdvanceTimerRef.current !== null) {
      window.clearTimeout(examAdvanceTimerRef.current);
      examAdvanceTimerRef.current = null;
    }
  }, []);

  const questionId = view?.question.id;
  const pick = view?.pick ?? null;
  const isCorrect = view?.isCorrect ?? null;
  const fast = !isExam && (config?.fast ?? false);
  const combo = view?.combo ?? 0;

  // 想太久的提示：這一題停太久沒作答，小貓跳到某個選項上猜一個（模擬考不提示）
  useCatHint({
    world,
    enabled: Boolean(view) && !isExam && pick === null,
    questionId: questionId ?? '',
    chars: view ? view.question.stem.length + view.question.options.reduce((sum, text) => sum + text.length, 0) : 0,
    order: view?.optionOrder ?? [],
    answer: view?.question.answer ?? [],
  });

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

  // 換題時重設原文／白話切換、選項中文顯示、抽屜與粒子狀態，並清除待執行跳題計時器
  useEffect(() => {
    clearExamAdvanceTimer();
    setTextMode('official');
    setShowOptionZh(false);
    setSheetOpen(false);
    setActiveLawRef(null);
    setBurstChoice(null);
  }, [questionId, clearExamAdvanceTimer]);

  // 模擬考每秒更新倒數
  useEffect(() => {
    if (!isExam) {
      clearExamAdvanceTimer();
      timedOutRef.current = false;
      setSubmitDialogOpen(false);
      setExamNavOpen(false);
      return undefined;
    }
    setNowTick(Date.now());
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
      clearExamAdvanceTimer();
    };
  }, [isExam, clearExamAdvanceTimer]);

  const clock = isExam ? examClock(world, new Date(nowTick)) : null;

  // 時間到直接交卷
  useEffect(() => {
    if (!isExam || !clock?.expired || timedOutRef.current) {
      return;
    }
    timedOutRef.current = true;
    clearExamAdvanceTimer();
    setExamNavOpen(false);
    setSubmitDialogOpen(false);
    onExamTimeout?.();
    dispatch(world, { type: 'quitRound' });
  }, [isExam, clock?.expired, world, onExamTimeout, clearExamAdvanceTimer]);

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

  const { question, group, enrich, zh, groupZh, index, total, optionOrder } = view;
  const paper = questionPaper(world, question.paperId);
  const outfit = catOutfit(world, leaderCat(world));
  const isAnswered = pick !== null;
  const bilingualEnabled = bilingualOn(world);
  const hasZh = Boolean(zh || groupZh);
  const showZh = !isExam && bilingualEnabled && hasZh;
  const showOptTranslation = Boolean(showZh && zh && (isAnswered || showOptionZh));

  const subjectName = paperSubjectName(world, paper);
  const sourceLabel = formatQuestionSource(world, paper, question.no, subjectName);
  const firstTopic = enrich?.topic[0];
  const topicLabel = isExam
    ? (subjectName ?? '模擬考')
    : firstTopic
      ? resolveTopicLabel(topics, firstTopic)
      : (subjectName ?? '題目');

  const sheet = isExam ? examSheet(world) : null;
  const answeredCount = isExam ? (sheet?.answered ?? 0) : index + (isAnswered ? 1 : 0);
  const unansweredCount = Math.max(0, total - answeredCount);

  const handlePick = (choice: Choice) => {
    if (isExam) {
      clearExamAdvanceTimer();
      dispatch(world, { type: 'examPick', pick: choice });
      if (index + 1 < total) {
        const reduced =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
          dispatch(world, { type: 'examGoto', index: index + 1 });
        } else {
          examAdvanceTimerRef.current = window.setTimeout(() => {
            examAdvanceTimerRef.current = null;
            dispatch(world, { type: 'examGoto', index: index + 1 });
          }, EXAM_ADVANCE_MS);
        }
      }
      return;
    }
    if (isAnswered) return;
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

  const handleExamPrev = () => {
    clearExamAdvanceTimer();
    if (index > 0) {
      dispatch(world, { type: 'examGoto', index: index - 1 });
    }
  };

  const handleExamNext = () => {
    clearExamAdvanceTimer();
    if (index + 1 < total) {
      dispatch(world, { type: 'examGoto', index: index + 1 });
    }
  };

  const handleOpenExamNav = () => {
    clearExamAdvanceTimer();
    setExamNavOpen(true);
  };

  const handleExamGoto = (targetIndex: number) => {
    clearExamAdvanceTimer();
    dispatch(world, { type: 'examGoto', index: targetIndex });
    setExamNavOpen(false);
  };

  const handleOpenSubmitDialog = () => {
    clearExamAdvanceTimer();
    setSubmitDialogOpen(true);
  };

  const handleNext = () => {
    if (!isAnswered) return;
    dispatch(world, { type: 'next' });
  };

  const handleQuit = () => {
    dispatch(world, { type: 'quitRound' });
  };

  const handleConfirmSubmit = () => {
    clearExamAdvanceTimer();
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
          <Chip tone="butter" onClick={handleOpenSubmitDialog}>
            交卷
          </Chip>
        </div>
      ) : (
        <div className="cb-q-topbar">
          <ProgressBar
            value={index + (isAnswered ? 1 : 0)}
            total={total}
            showCat
            runner={<PetRunner world={world} outfit={outfit} value={index + (isAnswered ? 1 : 0)} />}
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
          {!isExam && hasZh && (
            <BilingualToggle
              on={bilingualEnabled}
              onToggle={() => dispatch(world, { type: 'setBilingual', on: !bilingualEnabled })}
              className={enrich?.plain ? '' : 'cb-ml-auto'}
            />
          )}
        </div>

        {group && <PassageCard group={group} groupZh={isExam ? null : groupZh} bilingual={showZh} />}

        <p className="cb-stem">
          {!isExam && textMode === 'plain' && enrich?.plain ? (
            enrich.plain
          ) : isExam ? (
            question.stem
          ) : (
            <MarkedStem stem={question.stem} marks={enrich?.marks ?? []} />
          )}
        </p>

        {showZh && <StemTranslation stem={zh?.stem} />}

        <div className="cb-mt-sm">
          <Chip tone="plain">{sourceLabel}</Chip>
        </div>

        {!isExam && isAnswered && question.correction && (
          <CorrectionBox correction={question.correction} />
        )}
      </div>

      <div className="cb-q-opts-col">
        {/* 作答時改由答對／答錯的聲音回饋，不另外響按鍵聲；模擬考沒有即時對錯，照常響按鍵聲 */}
        <div className="cb-opts" data-sound={isExam ? undefined : 'none'}>
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
              <div key={choice} className="cb-opt-wrap" {...{ [CAT_CHOICE_ATTR]: choice }}>
                <button
                  type="button"
                  className={`cb-card cb-press cb-opt ${stateClass}`.trim()}
                  disabled={!isExam && isAnswered}
                  aria-pressed={isExam ? pick === choice : undefined}
                  onClick={() => handlePick(choice)}
                >
                  <span className="cb-opt-key">{choice}</span>
                  <span className="cb-grow">
                    <OptionTextWithZh
                      text={optText}
                      zh={showOptTranslation ? zh?.options[choice] : null}
                    />
                  </span>
                </button>
                {showBurst && <Burst key={burstChoice.tick} onDone={handleBurstDone} />}
              </div>
            );
          })}
        </div>

        {!isExam && showZh && zh && !isAnswered && (
          <OptionZhToggleButton
            open={showOptionZh}
            onToggle={() => setShowOptionZh((prev) => !prev)}
          />
        )}

        {isExam && (
          <div className="cb-acts cb-exam-nav cb-mt-md">
            <Button variant="ghost" disabled={index === 0} onClick={handleExamPrev}>
              上一題
            </Button>
            <Button variant="ghost" onClick={handleOpenExamNav}>
              題號
            </Button>
            {index + 1 < total ? (
              <Button onClick={handleExamNext}>下一題</Button>
            ) : (
              <Button onClick={handleOpenSubmitDialog}>交卷</Button>
            )}
          </div>
        )}

        {!isExam && isAnswered && (
          <div ref={feedbackRef} className="cb-stack-sm cb-mt-md">
            {showCompactFastFeedback && enrich ? (
              <>
                <Card tone="green" className="cb-kou cb-kou-compact">
                  <div className="cb-row">
                    <Cat size={58} mood="yay" scene="correct" spin={catSpin} outfit={outfit} interactive />
                    <div className="cb-grow">
                      <div className="cb-kou-head">
                        <small>答對！</small>
                        {!enrich.reviewed && <span className="cb-ai-tag">AI 解析</span>}
                      </div>
                      <b className="cb-kou-mnemonic">{enrich.mnemonic}</b>
                    </div>
                  </div>
                </Card>
                {showZh && zh && <QuestionVocabCard vocab={zh.vocab} />}
              </>
            ) : enrich ? (
              <>
                <EnrichCard
                  enrich={enrich}
                  tone={isCorrect ? 'green' : 'butter'}
                  className={isCorrect ? '' : 'is-miss'}
                  catMood={isCorrect ? 'yay' : 'oops'}
                  catScene={isCorrect ? 'correct' : 'wrong'}
                  catSpin={catSpin}
                  catOutfit={outfit}
                  label={
                    <small>{isCorrect ? '答對了！口訣再記一次' : '差一點！看這句馬上學會'}</small>
                  }
                  extra={<CardLinks world={world} questionId={question.id} />}
                />
                {showZh && zh && <QuestionVocabCard vocab={zh.vocab} />}
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
                      scene={isCorrect ? 'correct' : 'wrong'}
                      spin={catSpin}
                      outfit={outfit}
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
                {showZh && zh && <QuestionVocabCard vocab={zh.vocab} />}
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

      {isExam && sheet && (
        <Sheet
          open={examNavOpen}
          onClose={() => setExamNavOpen(false)}
          title="題號總覽"
        >
          <div className="cb-stack-sm">
            <div className="cb-exam-sheet-head">
              <strong className="cb-num-tabular">
                已作答 {sheet.answered} / {sheet.total}
              </strong>
            </div>
            <div className="cb-exam-grid">
              {sheet.items.map((item) => (
                <button
                  key={item.index}
                  type="button"
                  className={[
                    'cb-exam-cell',
                    'cb-press',
                    'cb-num-tabular',
                    item.picked ? 'is-picked' : '',
                    item.current ? 'is-current' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={item.current ? 'true' : undefined}
                  aria-label={`第 ${item.no} 題${item.picked ? '，已作答' : '，未作答'}${item.current ? '，目前題目' : ''}`}
                  onClick={() => handleExamGoto(item.index)}
                >
                  {item.no}
                </button>
              ))}
            </div>
          </div>
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
                  ? `還有 ${unansweredCount} 題沒寫，沒寫的題目不計分，確定要交卷嗎？`
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
