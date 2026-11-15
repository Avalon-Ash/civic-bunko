import { dispatch } from '../../core/commands';
import { getResultTier } from '../../core/constants/result';
import type { World } from '../../core/world';
import { roundSummary } from '../../selectors';
import { Button } from '../kit/Button';
import { Cat } from '../kit/Cat';
import { CountUp } from '../kit/CountUp';
import { useWorld } from '../useWorld';

export interface ResultScreenProps {
  world: World;
  onAgain: () => void;
  onHome: () => void;
}

/** 回合結果畫面：依答對率顯示印章與表情、答對分數、錯題重刷、再來一回合與回今日。 */
export function ResultScreen({ world, onAgain, onHome }: ResultScreenProps) {
  useWorld(world);
  const summary = roundSummary(world);

  if (!summary) {
    return null;
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
        <Cat size={96} mood={tier.catMood} interactive />
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
