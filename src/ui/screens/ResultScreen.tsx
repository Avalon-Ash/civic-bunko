import { useState } from 'react';
import { dispatch } from '../../core/commands';
import { getResultTier } from '../../core/constants/result';
import type { LawRef, QuestionId } from '../../core/types';
import type { World } from '../../core/world';
import { formatLawRef } from '../../data/laws';
import { questionPaper, roundSummary } from '../../selectors';
import { currentAccessory } from '../../selectors/daily';
import { examQuestionDetail, examResult } from '../../selectors/exam';
import { LawArticlePanel, OptionExplainList } from '../components/OptionExplain';
import {
  CHOICES,
  CorrectionBox,
  EnrichCard,
  formatExamLabel,
  MarkedStem,
  PassageCard,
} from '../components/QuestionParts';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import { CountUp } from '../kit/CountUp';
import { Sheet } from '../kit/Sheet';
import { useWorld } from '../useWorld';

export interface ResultScreenProps {
  world: World;
  onAgain: () => void;
  onHome: () => void;
}

/** 回合結果畫面：依答對率顯示印章與表情、答對分數、錯題重刷、再來一回合與回今日；模擬考則顯示總分、沒寫題數與錯題解析抽屜。 */
export function ResultScreen({ world, onAgain, onHome }: ResultScreenProps) {
  useWorld(world);
  const summary = roundSummary(world);
  const exam = examResult(world);
  const accessory = currentAccessory(world);

  const [inspectId, setInspectId] = useState<QuestionId | null>(null);
  const [activeLawRef, setActiveLawRef] = useState<LawRef | null>(null);

  if (!summary) {
    return null;
  }

  if (exam) {
    const paper = questionPaper(world, exam.paperId);
    const unanswered = Math.max(0, exam.total - exam.answered);
    const tier = getResultTier(exam.correct, exam.total);
    const inspectedWrong = inspectId ? exam.wrong.find((w) => w.id === inspectId) ?? null : null;
    const detail = inspectId ? examQuestionDetail(world, inspectId) : null;

    const closeSheet = () => {
      setInspectId(null);
      setActiveLawRef(null);
    };

    return (
      <div className="cb-stack">
        {paper && (
          <div className="cb-row cb-center">
            <Chip tone="plain">
              {paper.year} {formatExamLabel(paper.exam)}・{paper.subjectName}
            </Chip>
          </div>
        )}

        <Card tone="pink" className="cb-exam-score-card">
          <div className="cb-row cb-center">
            <Cat size={72} mood={tier.catMood} accessory={accessory} interactive />
            <div className="cb-exam-score-main">
              <div className="cb-exam-score-num cb-num-tabular">
                <CountUp value={exam.score} />
                <span className="cb-exam-score-unit">分</span>
              </div>
              <p className="cb-sub-strong cb-m0 cb-num-tabular">
                答對 {exam.correct} / {exam.total}
                {unanswered > 0 ? `，沒寫 ${unanswered} 題` : ''}
              </p>
            </div>
          </div>
        </Card>

        {exam.wrong.length > 0 ? (
          <section className="cb-section">
            <h2>錯題清單（{exam.wrong.length} 題）</h2>
            <div className="cb-stack-xs">
              {exam.wrong.map((item) => {
                const qDetail = examQuestionDetail(world, item.id);
                const stemText = qDetail?.question.stem ?? '';
                return (
                  <Card
                    key={item.id}
                    className="cb-exam-wrong-item"
                    onClick={() => {
                      setActiveLawRef(null);
                      setInspectId(item.id);
                    }}
                  >
                    <div className="cb-grow cb-stack-xs">
                      <div className="cb-row cb-wrap">
                        <Chip tone="butter">第 {item.no} 題</Chip>
                        <span className="cb-sub-strong">
                          你選 {item.pick}・正解 {item.answer.join('、')}
                        </span>
                      </div>
                      {stemText && <p className="cb-exam-wrong-stem">{stemText}</p>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : (
          <Card tone="mint">
            <p className="cb-sub-strong cb-m0">
              {unanswered > 0 ? '有寫的題目全都答對了！' : '整份全對！太厲害了！'}
            </p>
          </Card>
        )}

        <div className="cb-stack-sm">
          {exam.wrong.length > 0 && (
            <Button onClick={() => dispatch(world, { type: 'retryWrong' })}>
              錯題重刷（{exam.wrong.length} 題）
            </Button>
          )}
          <div className="cb-acts">
            <Button variant="ghost" onClick={onHome}>
              回今日
            </Button>
            <Button variant={exam.wrong.length > 0 ? 'ghost' : 'primary'} onClick={onAgain}>
              再來一回合
            </Button>
          </div>
        </div>

        <Sheet
          open={Boolean(inspectId && detail)}
          onClose={closeSheet}
          title={
            activeLawRef
              ? formatLawRef(activeLawRef)
              : inspectedWrong
                ? `第 ${inspectedWrong.no} 題解析`
                : '題目解析'
          }
        >
          {detail && (
            activeLawRef ? (
              <LawArticlePanel lawRef={activeLawRef} onBack={() => setActiveLawRef(null)} />
            ) : (
              <div className="cb-stack-sm">
                <div className="cb-row cb-wrap">
                  <Chip tone="butter">第 {detail.question.no} 題</Chip>
                  {inspectedWrong && (
                    <span className="cb-sub-strong">
                      你選 {inspectedWrong.pick}・正解 {detail.question.answer.join('、')}
                    </span>
                  )}
                  {detail.question.correction && <Chip tone="orange">官方更正</Chip>}
                </div>

                {detail.group && <PassageCard group={detail.group} />}

                <p className="cb-stem cb-m0">
                  <MarkedStem
                    stem={detail.question.stem}
                    marks={detail.enrich?.marks ?? []}
                  />
                </p>

                <div className="cb-opts">
                  {CHOICES.map((choice, idx) => {
                    const optText = detail.question.options[idx] ?? '';
                    const isRight = detail.question.answer.includes(choice);
                    const isPickedWrong = inspectedWrong?.pick === choice && !isRight;
                    const cls = isRight ? 'is-right' : isPickedWrong ? 'is-picked' : 'is-dim';
                    return (
                      <div key={choice} className={`cb-card cb-opt ${cls}`}>
                        <span className="cb-opt-key">{choice}</span>
                        <span className="cb-grow">{optText}</span>
                      </div>
                    );
                  })}
                </div>

                {detail.question.correction && (
                  <CorrectionBox correction={detail.question.correction} />
                )}

                {detail.enrich ? (
                  <>
                    <EnrichCard
                      enrich={detail.enrich}
                      tone="butter"
                      catMood="oops"
                      catAccessory={accessory}
                      label={<small>錯題複習・口訣與陷阱</small>}
                    />
                    <OptionExplainList
                      question={detail.question}
                      enrich={detail.enrich}
                      onSelectLaw={setActiveLawRef}
                    />
                  </>
                ) : (
                  <Card tone="butter" className="cb-kou is-miss">
                    <div className="cb-row">
                      <Cat size={58} mood="oops" accessory={accessory} interactive />
                      <div className="cb-grow">
                        <small>正解是 ({detail.question.answer.join('、')})</small>
                        <div className="cb-sub-strong">口訣準備中</div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )
          )}
        </Sheet>
      </div>
    );
  }

  if (summary.study === 'read') {
    return (
      <div className="cb-result cb-result-shake">
        <div className="cb-spacer" />
        <div className="cb-stamp" aria-label="看完了">
          看完了
        </div>
        <div className="cb-result-score">
          <h1>
            {summary.questionCount} 題 × {summary.passes} 遍
          </h1>
          <p className="cb-sub cb-result-note">先把這批記熟，再換自己作答試試看。</p>
        </div>
        <div className="cb-row cb-center">
          <Cat size={96} mood="yay" accessory={accessory} interactive />
        </div>
        <div className="cb-spacer" />
        <div className="cb-stack-sm">
          <Button onClick={() => dispatch(world, { type: 'quizSameSet' })}>
            換我作答這批
          </Button>
          <div className="cb-acts">
            <Button variant="ghost" onClick={onHome}>
              回今日
            </Button>
            <Button variant="ghost" onClick={onAgain}>
              再看一批
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const wrongCount = summary.wrongIds.length;
  const tier = getResultTier(summary.correct, summary.total);

  return (
    <div className="cb-result cb-result-shake">
      <div className="cb-spacer" />
      <div className="cb-stamp" aria-label={tier.stampLabel}>
        {tier.stampLines.length === 2 ? (
          <>
            {tier.stampLines[0]}
            <br />
            {tier.stampLines[1]}
          </>
        ) : (
          tier.stampLines[0]
        )}
      </div>
      <div className="cb-result-score">
        <h1>
          <CountUp value={summary.correct} /> / {summary.total}
        </h1>
        <p className="cb-sub cb-result-note">
          {wrongCount > 0 ? `答錯的 ${wrongCount} 題，之後會再回來找你。` : '全對！太厲害了！'}
        </p>
      </div>
      <div className="cb-row cb-center">
        <Cat size={96} mood={tier.catMood} accessory={accessory} interactive />
      </div>
      <div className="cb-spacer" />
      <div className="cb-stack-sm">
        {wrongCount > 0 && (
          <Button onClick={() => dispatch(world, { type: 'retryWrong' })}>
            錯題重刷（{wrongCount} 題）
          </Button>
        )}
        <div className="cb-acts">
          <Button variant="ghost" onClick={onHome}>
            回今日
          </Button>
          <Button variant={wrongCount > 0 ? 'ghost' : 'primary'} onClick={onAgain}>
            再來一回合
          </Button>
        </div>
      </div>
    </div>
  );
}
