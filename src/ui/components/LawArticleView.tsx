import { useEffect, useState } from 'react';
import type { LawRef } from '../../core/types';
import { formatLawRef, loadLawArticle, type LawArticleResult } from '../../data/laws';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';

export interface LawArticleViewProps {
  lawRef: LawRef;
  onBack?: () => void;
  backLabel?: string;
}

/** 載入並顯示單一法條原文（含載入中與查無此條狀態）。 */
export function LawArticleView({
  lawRef,
  onBack,
  backLabel = '← 返回',
}: LawArticleViewProps) {
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
        {onBack && (
          <Chip tone="plain" onClick={onBack}>
            {backLabel}
          </Chip>
        )}
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
