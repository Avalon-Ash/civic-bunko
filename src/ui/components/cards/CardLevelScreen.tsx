// 圖卡闖關的關卡頁（docs/plans/level-mode.md、ADR 0023）：一張有漫畫的卡＝一關，三步 看圖 → 配對 → 實戰。
// 沒有的步驟不列（沒掛題就沒有實戰）。星星只從 selectors/cardLevel 讀；開著哪一關、第幾步在 useLevel（只在記憶體）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatch } from '../../../core/commands';
import type { LawRef } from '../../../core/types';
import type { World } from '../../../core/world';
import { formatLawRef } from '../../../data/laws';
import { currentQuestion, readView, roundSummary } from '../../../selectors';
import { cardHasMatch, cardStars, type CardStars } from '../../../selectors/cardLevel';
import { cardQuestionIds } from '../../../selectors/cardLinks';
import type { CardView } from '../../../selectors/cards';
import { Button } from '../../kit/Button';
import { Card } from '../../kit/Card';
import { Chip } from '../../kit/Chip';
import { Segmented, type SegmentedOption } from '../../kit/Segmented';
import { Visual } from '../../kit/Visual';
import { QuestionScreen } from '../../screens/QuestionScreen';
import { useGo } from '../../useGuide';
import { useLevel, type LevelStep } from '../../useLevel';
import { useWorld } from '../../useWorld';
import { LawArticleView } from '../LawArticleView';
import { CardFaceViewer } from './CardFaceViewer';
import { CardLawChips } from './CardLawChips';
import { ComicMatch } from './comic/ComicMatch';
import { ComicSection } from './comic/ComicSection';

const STEP_LABEL: Readonly<Record<LevelStep, string>> = {
  look: '看圖',
  match: '配對',
  quiz: '實戰',
};

/** 這一步拿到星星了沒（看圖＝看過、配對＝配對過、實戰＝題目都答對過） */
function stepDone(step: LevelStep, stars: CardStars): boolean {
  return step === 'look' ? stars.seen : step === 'match' ? stars.matched === true : stars.cleared === true;
}

/** 星星：有幾步就畫幾顆，拿到的實心 */
export function LevelStars({ stars, className = '' }: { stars: CardStars; className?: string }) {
  return (
    <span className={`cb-level-stars ${className}`.trim()} aria-label={`星星 ${stars.earned}/${stars.total}`}>
      {Array.from({ length: stars.total }, (_, i) => (
        <span key={i} className={i < stars.earned ? 'is-on' : ''} aria-hidden="true">
          {i < stars.earned ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

export interface CardLevelScreenProps {
  world: World;
  card: CardView;
}

export function CardLevelScreen({ world, card }: CardLevelScreenProps) {
  useWorld(world);
  const { level, setStep, close, startQuiz, quizCardId } = useLevel();
  const go = useGo();
  const [activeLawRef, setActiveLawRef] = useState<LawRef | null>(null);
  const [completing, setCompleting] = useState(false);
  const [burstTick, setBurstTick] = useState<number | null>(null);
  const [matchedNow, setMatchedNow] = useState(false);

  const comic = card.comic;
  const questionCount = cardQuestionIds(world, card.id).length;
  const steps: LevelStep[] = ['look', ...(comic && cardHasMatch(card) ? (['match'] as const) : []), ...(questionCount > 0 ? (['quiz'] as const) : [])];
  const step: LevelStep = level && steps.includes(level.step) ? level.step : 'look';
  const stars = cardStars(world, card);
  const nextStep = steps[steps.indexOf(step) + 1] ?? null;

  // 第 3 步的「這次成績」：只認這一關打開之後才有的回合成績（一題都沒答就結束的不算），避免顯示上一回合的舊成績。
  // 換一關時 CardsScreen 會用 key 重建本元件，這個起點跟著重設。
  const myQuiz = quizCardId === card.id;
  const entrySummaryRef = useRef(roundSummary(world));

  useEffect(() => {
    setActiveLawRef(null);
    setCompleting(false);
    setBurstTick(null);
    setMatchedNow(false);
  }, [card.id, step]);

  const handleSeen = useCallback(() => {
    if (completing) return;
    setCompleting(true);
    dispatch(world, { type: 'markCardSeen', id: card.id });
    setBurstTick((prev) => (prev ?? 0) + 1);
  }, [world, card.id, completing]);

  const handleBurstDone = useCallback(() => {
    setBurstTick(null);
    setCompleting(false);
    if (nextStep) setStep(nextStep);
  }, [nextStep, setStep]);

  const stepOptions: SegmentedOption<LevelStep>[] = steps.map((s, i) => ({
    value: s,
    label: `${i + 1} ${STEP_LABEL[s]}${stepDone(s, stars) ? ' ★' : ''}`,
  }));

  const anyRound = currentQuestion(world) !== null || readView(world) !== null;
  const inLevelQuiz = myQuiz && currentQuestion(world) !== null;
  const otherRound = anyRound && !myQuiz;
  const latest = roundSummary(world);
  const summary = latest !== entrySummaryRef.current && latest && latest.total > 0 ? latest : null;

  return (
    <div className="cb-stack cb-level">
      <div className="cb-level-top">
        <Button variant="ghost" className="cb-level-back" onClick={close}>
          ← 回圖卡
        </Button>
        {card.subjectShort ? <Chip tone="butter">{card.subjectShort}</Chip> : null}
        <LevelStars stars={stars} />
      </div>
      <header className="cb-level-head">
        <h1 className="cb-level-title">{activeLawRef ? formatLawRef(activeLawRef) : card.title}</h1>
        {activeLawRef ? null : <p className="cb-card-sheet-hook">{card.hook}</p>}
      </header>

      {activeLawRef ? (
        <LawArticleView lawRef={activeLawRef} onBack={() => setActiveLawRef(null)} backLabel="← 返回關卡" />
      ) : (
        <>
          {steps.length > 1 ? (
            <Segmented
              options={stepOptions}
              value={step}
              onChange={setStep}
              ariaLabel="關卡步驟"
              className="cb-seg-fill cb-level-steps"
            />
          ) : null}

          {step === 'look' ? (
            <>
              {comic ? <ComicSection card={{ ...card, comic }} /> : null}
              {card.visual ? <Visual visual={card.visual} /> : null}
              <CardFaceViewer
                cardId={card.id}
                faces={card.faces}
                onComplete={handleSeen}
                completing={completing}
                burstTick={burstTick}
                onBurstDone={handleBurstDone}
              />
              <CardLawChips lawRefs={card.lawRefs} onOpen={setActiveLawRef} />
            </>
          ) : null}

          {step === 'match' && comic ? (
            <>
              <ComicMatch
                world={world}
                card={{ ...card, comic }}
                onComplete={() => {
                  dispatch(world, { type: 'markCardMatched', id: card.id });
                  setMatchedNow(true);
                }}
              />
              {matchedNow && nextStep ? (
                <Button variant="mint" className="cb-level-next" onClick={() => setStep(nextStep)}>
                  下一步：{STEP_LABEL[nextStep]}
                </Button>
              ) : null}
            </>
          ) : null}

          {step === 'quiz' ? (
            inLevelQuiz ? (
              <div className="cb-level-quiz">
                <QuestionScreen world={world} hideCardLinks />
              </div>
            ) : otherRound ? (
              <Card className="cb-level-note">
                <p>刷題頁還有一回合沒做完，先把它做完再來實戰。</p>
                <Button variant="ghost" className="cb-level-next" onClick={() => go({ tab: 'quiz' })}>
                  去刷題頁
                </Button>
              </Card>
            ) : (
              <Card className="cb-level-note">
                {summary ? (
                  <p className="cb-level-result">
                    這次答對 <strong>{summary.correct}</strong> / {summary.total} 題
                    {stars.cleared
                      ? '，這關的題目都答對過了！'
                      : `。這關 ${stars.quizTotal} 題已經答對過 ${stars.quizCleared} 題，都答對過就拿到第三顆星。`}
                  </p>
                ) : (
                  <p>
                    這張卡連到 {questionCount} 題考古題，答法和刷題一樣，會計小魚乾。
                    {stars.quizCleared > 0 ? `已經答對過 ${stars.quizCleared} 題。` : ''}
                  </p>
                )}
                <Button
                  variant="mint"
                  className="cb-level-next"
                  onClick={() => {
                    entrySummaryRef.current = roundSummary(world);
                    startQuiz(card.id);
                  }}
                >
                  {summary ? '再實戰一次' : `開始實戰（${questionCount} 題）`}
                </Button>
              </Card>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
