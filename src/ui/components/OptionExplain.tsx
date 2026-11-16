import type { Enrich, LawRef, OfficialQuestion } from '../../core/types';
import { formatLawRef } from '../../data/laws';
import { Chip } from '../kit/Chip';
import { LawArticleView } from './LawArticleView';
import { CHOICES } from './QuestionParts';

export interface LawArticlePanelProps {
  lawRef: LawRef;
  onBack: () => void;
  backLabel?: string;
}

/** 抽屜內的法條原文查詢檢視：沿用共用的 LawArticleView。 */
export function LawArticlePanel({
  lawRef,
  onBack,
  backLabel = '← 返回選項',
}: LawArticlePanelProps) {
  return <LawArticleView lawRef={lawRef} onBack={onBack} backLabel={backLabel} />;
}

export interface OptionExplainListProps {
  question: OfficialQuestion;
  enrich: Enrich;
  onSelectLaw: (ref: LawRef) => void;
}

/** 抽屜內的逐選項解析清單（依官方 A–D 順序顯示），可點擊條號查看法條原文。 */
export function OptionExplainList({
  question,
  enrich,
  onSelectLaw,
}: OptionExplainListProps) {
  return (
    <div>
      <div className="cb-row cb-wrap cb-mb-sm">
        <strong className="cb-grow">逐選項解析</strong>
        {!enrich.reviewed && <span className="cb-ai-tag">AI 解析</span>}
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
                  <Chip tone="blue" onClick={() => onSelectLaw(detail.lawRef!)}>
                    {formatLawRef(detail.lawRef)}
                  </Chip>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
