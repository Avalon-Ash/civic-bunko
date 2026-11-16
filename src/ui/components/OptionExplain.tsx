import { useEffect, useState } from 'react';
import type { Enrich, LawRef, OfficialQuestion } from '../../core/types';
import { formatLawRef, loadLawArticle, type LawArticleResult } from '../../data/laws';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import { CHOICES } from './QuestionParts';

export interface LawArticlePanelProps {
  lawRef: LawRef;
  onBack: () => void;
  backLabel?: string;
}

/** 抽屜內的法條原文查詢檢視，共用給作答畫面與模擬考結果檢視。 */
export function LawArticlePanel({
  lawRef,
  onBack,
  backLabel = '← 返回選項',
}: LawArticlePanelProps) {
  const [lawState, setLawState] = useState<{ status: 'loading' } | LawArticleResult>({
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    setLawState({ status: 'loading' });

    loadLawArticle(lawRef)
      .then((result) => {
        if (!cancelled) {
          setLawState(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLawState({
            status: 'not_found',
            lawName: lawRef.law,
            amendedAt: null,
            url: null,
            articleNo: lawRef.article,
            text: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lawRef]);

  return (
    <div className="cb-stack-sm">
      <div className="cb-row cb-wrap">
        <Chip tone="plain" onClick={onBack}>
          {backLabel}
        </Chip>
        <strong className="cb-grow">{formatLawRef(lawRef)}</strong>
      </div>
      {lawState.status === 'loading' ? (
        <div className="cb-law-loading">
          <Cat size={64} mood="sleepy" interactive={false} />
          <span className="cb-sub">正在翻找法條…</span>
        </div>
      ) : lawState.status === 'found' ? (
        <div className="cb-law-view">
          <div className="cb-law-meta">
            全國法規資料庫・
            {lawState.amendedAt ? `修正日期 ${lawState.amendedAt}` : '未載修正日期'}
          </div>
          <p className="cb-law-text">{lawState.text}</p>
        </div>
      ) : (
        <div className="cb-law-empty">
          <div className="cb-law-meta">
            全國法規資料庫
            {lawState.amendedAt ? `・修正日期 ${lawState.amendedAt}` : ''}
          </div>
          <p className="cb-sub-strong cb-m0">找不到這一條</p>
        </div>
      )}
    </div>
  );
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
