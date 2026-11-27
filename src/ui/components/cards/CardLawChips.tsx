// 圖卡的「相關法條」籤：點了在原地看條文（抽屜與關卡頁共用）。
import type { LawRef } from '../../../core/types';
import { formatLawRef } from '../../../data/laws';
import { Chip } from '../../kit/Chip';

export function CardLawChips({ lawRefs, onOpen }: { lawRefs: readonly LawRef[]; onOpen: (ref: LawRef) => void }) {
  if (lawRefs.length === 0) return null;
  return (
    <div className="cb-card-laws">
      <span className="cb-card-laws-label">相關法條</span>
      <div className="cb-pick-grid">
        {lawRefs.map((ref, idx) => (
          <Chip key={`${ref.law}-${ref.article}-${idx}`} tone="blue" onClick={() => onOpen(ref)}>
            {formatLawRef(ref)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
