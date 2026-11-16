import { useEffect, useState } from 'react';
import type { GroupZh, VocabEntry } from '../../core/types';
import { Card } from '../kit/Card';
import { Chip } from '../kit/Chip';
import '../bilingual.css';

export interface BilingualToggleProps {
  on: boolean;
  onToggle: () => void;
  className?: string;
}

/** 題卡上方的「中英對照」切換膠囊。 */
export function BilingualToggle({ on, onToggle, className = '' }: BilingualToggleProps) {
  return (
    <Chip tone="mint" active={on} onClick={onToggle} className={className}>
      中英對照
    </Chip>
  );
}

/** 題組文章逐句對照區塊（英文在上、中文在下）。 */
export function BilingualSegments({ segments }: { segments: GroupZh['segments'] }) {
  return (
    <div className="cb-zh-segments">
      {segments.map((seg, i) => (
        <div key={i} className="cb-zh-segment">
          <p className="cb-zh-seg-en">{seg.en}</p>
          <p className="cb-zh-seg-zh">{seg.zh}</p>
        </div>
      ))}
    </div>
  );
}

/** 重點單字清單（英文粗體＋中文）。 */
export function VocabList({ vocab }: { vocab: readonly VocabEntry[] }) {
  if (vocab.length === 0) return null;
  return (
    <ul className="cb-zh-vocab-list">
      {vocab.map((entry, i) => (
        <li key={`${entry.en}-${i}`} className="cb-zh-vocab-item">
          <strong className="cb-zh-vocab-en">{entry.en}</strong>
          <span className="cb-zh-vocab-zh">{entry.zh}</span>
        </li>
      ))}
    </ul>
  );
}

/** 題組文章下方的可收合單字表（預設收合）。 */
export function GroupVocabCollapse({
  groupId,
  vocab,
}: {
  groupId: string;
  vocab: readonly VocabEntry[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [groupId]);

  if (vocab.length === 0) return null;

  return (
    <div className="cb-zh-vocab-box">
      <button
        type="button"
        className="cb-zh-vocab-toggle"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>單字表（{vocab.length}）</span>
        <span className="cb-zh-vocab-state">{open ? '收合' : '展開'}</span>
      </button>
      {open && <VocabList vocab={vocab} />}
    </div>
  );
}

/** 題幹下方的中文翻譯；無中譯（例如克漏字）時不顯示。 */
export function StemTranslation({ stem }: { stem: string | null | undefined }) {
  if (!stem) return null;
  return <p className="cb-zh-stem">{stem}</p>;
}

/** 選項文字與（可選的）選項中譯。 */
export function OptionTextWithZh({ text, zh }: { text: string; zh?: string | null }) {
  return (
    <>
      <span className="cb-zh-opt-en">{text}</span>
      {zh ? <span className="cb-zh-opt-zh">{zh}</span> : null}
    </>
  );
}

/** 作答前選項區下方「看選項中文」切換鈕。 */
export function OptionZhToggleButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="cb-zh-opt-btn-wrap">
      <button
        type="button"
        className="cb-zh-opt-btn cb-press"
        aria-pressed={open}
        onClick={onToggle}
      >
        {open ? '收起選項中文' : '看選項中文'}
      </button>
    </div>
  );
}

/** 口訣卡下方的「這題的單字」區塊；沒有單字時不顯示。 */
export function QuestionVocabCard({ vocab }: { vocab: readonly VocabEntry[] }) {
  if (vocab.length === 0) return null;
  return (
    <Card className="cb-zh-q-vocab">
      <strong className="cb-zh-vocab-title">這題的單字</strong>
      <VocabList vocab={vocab} />
    </Card>
  );
}
