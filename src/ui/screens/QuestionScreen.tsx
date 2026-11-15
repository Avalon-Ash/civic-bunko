import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { dispatch } from '../../core/commands';
import { FAST_ADVANCE_MS } from '../../core/constants/round';
import type { Choice, Enrich } from '../../core/types';
import type { World } from '../../core/world';
import { currentQuestion, currentRoundConfig, questionPaper } from '../../selectors';
import { Burst } from '../kit/Burst';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import { ProgressBar } from '../kit/ProgressBar';
import { Segmented, type SegmentedOption } from '../kit/Segmented';
import { Sheet } from '../kit/Sheet';
import { Toast } from '../kit/Toast';
import { useWorld } from '../useWorld';

const CHOICES: readonly Choice[] = ['A', 'B', 'C', 'D'];
const MILESTONE_COMBOS = new Set([5, 10, 20, 30]);
const TEXT_MODE_OPTIONS: readonly SegmentedOption<'official' | 'plain'>[] = [
  { value: 'official', label: '原文' },
  { value: 'plain', label: '白話' },
];

function renderMarkedStem(stem: string, marks: Enrich['marks']): ReactNode {
  if (marks.length === 0) return stem;

  const sorted = [...marks]
    .map((m) => ({
      start: Math.max(0, Math.min(stem.length, m.start)),
      end: Math.max(0, Math.min(stem.length, m.end)),
      color: m.color,
    }))
    .filter((m) => m.end > m.start)
    .sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const m = sorted[i];
    if (!m || m.start < cursor) continue;
    if (m.start > cursor) {
      nodes.push(stem.slice(cursor, m.start));
    }
    nodes.push(
      <mark key={`${m.start}-${m.end}-${i}`} className={`cb-mark-${m.color}`}>
        {stem.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }

  if (cursor < stem.length) {
    nodes.push(stem.slice(cursor));
  }
  return nodes;
}

export interface QuestionScreenProps {
  world: World;
}

/** 作答畫面：進度條與小貓、題組文章收合、四色標記題幹、四個選項與粒子噴發、回饋卡與選項解析抽屜。 */
export function QuestionScreen({ world }: QuestionScreenProps) {
  useWorld(world);
  const view = currentQuestion(world);
  const config = currentRoundConfig(world);

  const [textMode, setTextMode] = useState<'official' | 'plain'>('official');
  const [groupExpanded, setGroupExpanded] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [burstChoice, setBurstChoice] = useState<{ choice: Choice; tick: number } | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [catSpin, setCatSpin] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const questionId = view?.question.id;
  const pick = view?.pick ?? null;
  const isCorrect = view?.isCorrect ?? null;
  const fast = config?.fast ?? false;
  const combo = view?.combo ?? 0;

  // 換題時重設原文／白話切換、抽屜與粒子狀態
  useEffect(() => {
    setTextMode('official');
    setSheetOpen(false);
    setBurstChoice(null);
  }, [questionId]);

  // 連對里程碑横幅與貓咪轉圈
  const prevComboRef = useRef(0);
  useEffect(() => {
    if (combo > prevComboRef.current && MILESTONE_COMBOS.has(combo)) {
      setMilestoneToast(`連對 ${combo}！`);
      setCatSpin(true);
      const timer = window.setTimeout(() => setCatSpin(false), 900);
      prevComboRef.current = combo;
      return () => window.clearTimeout(timer);
    }
    prevComboRef.current = combo;
    return undefined;
  }, [combo]);

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

  const { question, group, enrich, index, total } = view;
  const paper = questionPaper(world, question.paperId);
  const isAnswered = pick !== null;

  const examLabel = paper ? (paper.exam === 'general' ? '普考' : '地特四等') : '';
  const sourceLabel = paper
    ? `${paper.year} ${examLabel}・${paper.subjectName} 第 ${question.no} 題`
    : `第 ${question.no} 題`;
  const topicLabel = enrich?.topic[0] ?? paper?.subjectName ?? '題目';

  const handlePick = (choice: Choice) => {
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

  const handleNext = () => {
    if (!isAnswered) return;
    dispatch(world, { type: 'next' });
  };

  const handleQuit = () => {
    dispatch(world, { type: 'quitRound' });
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isAnswered || sheetOpen || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (dx < -70 && Math.abs(dy) < 50) {
      handleNext();
    }
  };

  const showCompactFastFeedback = Boolean(enrich && fast && isCorrect);

  return (
    <div
      className="cb-question-layout"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Toast message={milestoneToast} onDismiss={() => setMilestoneToast(null)} />

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

      <div className="cb-q-stem-col">
        <div className="cb-row cb-wrap">
          <Chip tone="butter">{topicLabel}</Chip>
          {question.correction && <Chip tone="orange">官方更正</Chip>}
          {enrich?.plain && (
            <Segmented
              options={TEXT_MODE_OPTIONS}
              value={textMode}
              onChange={setTextMode}
              ariaLabel="題目版本切換"
              className="cb-ml-auto"
            />
          )}
        </div>

        {group && (
          <Card className="cb-passage-card">
            <button
              type="button"
              className="cb-passage-toggle"
              aria-expanded={groupExpanded}
              onClick={() => setGroupExpanded((open) => !open)}
            >
              <span>題組文章（第 {group.fromNo}–{group.toNo} 題）</span>
              <span className="cb-sub">{groupExpanded ? '收合' : '展開'}</span>
            </button>
            {groupExpanded && <p className="cb-passage-text">{group.text}</p>}
          </Card>
        )}

        <p className="cb-stem">
          {textMode === 'plain' && enrich?.plain
            ? enrich.plain
            : renderMarkedStem(question.stem, enrich?.marks ?? [])}
        </p>

        <div className="cb-mt-sm">
          <Chip tone="plain">{sourceLabel}</Chip>
        </div>

        {isAnswered && question.correction && (
          <Card tone="orange" className="cb-correction-box cb-mt-md">
            <div className="cb-row cb-wrap">
              <Chip tone="orange">官方更正</Chip>
              <span className="cb-sub-strong">原答案：{question.correction.original.join('、')}</span>
            </div>
            <p className="cb-correction-note">{question.correction.note}</p>
          </Card>
        )}
      </div>

      <div className="cb-q-opts-col">
        <div className="cb-opts">
          {CHOICES.map((choice, idx) => {
            const optText = question.options[idx] ?? '';
            const isChoiceRight = question.answer.includes(choice);
            const isPickedWrong = isAnswered && pick === choice && !isChoiceRight;
            const isDimmed = isAnswered && !isChoiceRight && pick !== choice;

            const stateClass = isAnswered
              ? isChoiceRight
                ? 'is-right'
                : isPickedWrong
                  ? 'is-picked'
                  : isDimmed
                    ? 'is-dim'
                    : ''
              : '';

            const showBurst = burstChoice?.choice === choice;

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

        {isAnswered && (
          <div ref={feedbackRef} className="cb-stack-sm cb-mt-md">
            {showCompactFastFeedback && enrich ? (
              <Card tone="green" className="cb-kou">
                <div className="cb-row">
                  <Cat size={58} mood="yay" spin={catSpin} interactive />
                  <div className="cb-grow">
                    <div className="cb-kou-head">
                      <small>答對！</small>
                      {!enrich.reviewed && <Chip tone="plain">AI 解析</Chip>}
                    </div>
                    <b className="cb-kou-mnemonic">{enrich.mnemonic}</b>
                  </div>
                </div>
              </Card>
            ) : enrich ? (
              <>
                <Card tone={isCorrect ? 'green' : 'butter'} className={`cb-kou ${isCorrect ? '' : 'is-miss'}`}>
                  <div className="cb-row">
                    <Cat
                      size={58}
                      mood={isCorrect ? 'yay' : 'oops'}
                      spin={catSpin}
                      interactive
                    />
                    <div className="cb-grow">
                      <div className="cb-kou-head">
                        <small>{isCorrect ? '答對了！口訣再記一次' : '差一點！看這句馬上學會'}</small>
                        {!enrich.reviewed && <Chip tone="plain">AI 解析</Chip>}
                      </div>
                      <b className="cb-kou-mnemonic">{enrich.mnemonic}</b>
                    </div>
                  </div>
                  <div className="cb-trap">
                    <em>陷阱</em>
                    <span>{enrich.trap}</span>
                  </div>
                </Card>
                <div className="cb-acts">
                  <Button variant="ghost" onClick={() => setSheetOpen(true)}>
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

      {enrich && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="每個選項的說明">
          <div className="cb-row cb-wrap cb-mb-sm">
            <strong className="cb-grow">逐選項解析</strong>
            {!enrich.reviewed && <Chip tone="plain">AI 解析</Chip>}
          </div>
          {CHOICES.map((choice) => {
            const detail = enrich.options[choice];
            const isAnswer = question.answer.includes(choice);
            return (
              <div key={choice} className={`cb-sheet-line ${isAnswer ? 'is-ok' : ''}`}>
                <span className="cb-sheet-key">{choice}</span>
                <div className="cb-grow">
                  <div>{detail.why}</div>
                  {detail.lawRef && (
                    <div className="cb-mt-xs">
                      <mark className="cb-mark-blue">
                        {detail.lawRef.law} {detail.lawRef.article}
                      </mark>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </Sheet>
      )}
    </div>
  );
}
