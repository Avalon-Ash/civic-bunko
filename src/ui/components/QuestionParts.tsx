import { Fragment, useEffect, useState, type ReactNode } from 'react';
import type { AccessoryId, Choice, Correction, Enrich, ExamKind, GroupZh, Paper, PassageGroup } from '../../core/types';
import { Card, type CardTone } from '../kit/Card';
import { Cat, type CatMood } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import type { SegmentedOption } from '../kit/Segmented';
import { Visual } from '../kit/Visual';
import { splitByMarks } from '../marks';
import { BilingualSegments, GroupVocabCollapse } from './Bilingual';

export const CHOICES: readonly Choice[] = ['A', 'B', 'C', 'D'];

export const TEXT_MODE_OPTIONS: readonly SegmentedOption<'official' | 'plain'>[] = [
  { value: 'official', label: '原文' },
  { value: 'plain', label: '白話' },
];

/** 格式化考試別顯示名稱（general＝普考、local4＝地特四等）。 */
export function formatExamLabel(exam: ExamKind): string {
  return exam === 'general' ? '普考' : '地特四等';
}

/** 格式化題目來源標籤（年度・考試・科目・題號）；subjectName 傳題庫登記的科目名稱，沒傳才用官方全名。 */
export function formatQuestionSource(
  paper: Paper | null,
  questionNo: number,
  subjectName?: string | null,
): string {
  if (!paper) return `第 ${questionNo} 題`;
  return `${paper.year} ${formatExamLabel(paper.exam)}・${subjectName ?? paper.subjectName} 第 ${questionNo} 題`;
}

/** 依 marks 渲染四色標記題幹。 */
export function MarkedStem({
  stem,
  marks,
}: {
  stem: string;
  marks: Enrich['marks'];
}): ReactNode {
  const segments = splitByMarks(stem, marks);
  if (segments.length === 0) return stem;

  return segments.map((seg, i) =>
    seg.color ? (
      <mark key={`${i}-${seg.color}`} className={`cb-mark-${seg.color}`}>
        {seg.text}
      </mark>
    ) : (
      <Fragment key={i}>{seg.text}</Fragment>
    ),
  );
}

export interface PassageCardProps {
  group: PassageGroup;
  groupZh?: GroupZh | null;
  bilingual?: boolean;
}

/** 題組共用文章可收合卡片（支援逐句中英對照與可收合單字表）。 */
export function PassageCard({ group, groupZh = null, bilingual = false }: PassageCardProps) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setExpanded(true);
  }, [group.id]);

  const showSegments = Boolean(bilingual && groupZh && groupZh.segments.length > 0);
  const showVocab = Boolean(bilingual && groupZh && groupZh.vocab.length > 0);

  return (
    <Card className="cb-passage-card">
      <button
        type="button"
        className="cb-passage-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span>題組文章（第 {group.fromNo}–{group.toNo} 題）</span>
        <span className="cb-sub">{expanded ? '收合' : '展開'}</span>
      </button>
      {expanded && (
        showSegments && groupZh ? (
          <BilingualSegments segments={groupZh.segments} />
        ) : (
          <p className="cb-passage-text">{group.text}</p>
        )
      )}
      {expanded && showVocab && groupZh && (
        <GroupVocabCollapse groupId={group.id} vocab={groupZh.vocab} />
      )}
    </Card>
  );
}

/** 官方更正說明區塊。 */
export function CorrectionBox({ correction }: { correction: Correction }) {
  return (
    <Card tone="orange" className="cb-correction-box cb-mt-md">
      <div className="cb-row cb-wrap">
        <Chip tone="orange">官方更正</Chip>
        <span className="cb-sub-strong">原答案：{correction.original.join('、')}</span>
      </div>
      <p className="cb-correction-note">{correction.note}</p>
    </Card>
  );
}

export interface EnrichCardProps {
  enrich: Enrich;
  tone?: CardTone;
  className?: string;
  catMood?: CatMood;
  catSpin?: boolean;
  catAccessory?: AccessoryId | null;
  label: ReactNode;
}

/** 加工內容卡片（口訣、小圖、陷阱、低把握與修法提醒）。 */
export function EnrichCard({
  enrich,
  tone = 'surface',
  className = '',
  catMood = 'idle',
  catSpin = false,
  catAccessory = null,
  label,
}: EnrichCardProps) {
  return (
    <Card tone={tone} className={`cb-kou ${className}`.trim()}>
      <div className="cb-row">
        <Cat size={58} mood={catMood} spin={catSpin} accessory={catAccessory} interactive />
        <div className="cb-grow">
          <div className="cb-kou-head">
            {label}
            {!enrich.reviewed && <span className="cb-ai-tag">AI 解析</span>}
          </div>
          <b className="cb-kou-mnemonic">{enrich.mnemonic}</b>
        </div>
      </div>
      {enrich.visual && <Visual visual={enrich.visual} />}
      {enrich.trap && (
        <div className="cb-trap">
          <em>陷阱</em>
          <span>{enrich.trap}</span>
        </div>
      )}
      {enrich.confidence === 'low' && (
        <p className="cb-kou-low">這題的說明把握較低，以官方答案為準</p>
      )}
      {enrich.lawChanged !== null && (
        <div className="cb-law-changed">
          <span className="cb-law-changed-badge">修法提醒</span>
          <span className="cb-grow">{enrich.lawChanged}</span>
        </div>
      )}
    </Card>
  );
}
