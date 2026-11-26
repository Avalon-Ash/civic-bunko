import { useEffect, useId, useState, type FormEvent } from 'react';
import { CAT_NAME_MAX } from '../../core/constants/cat';
import { CAT_CHARACTER } from '../../core/constants/catLines';
import { GUIDE } from '../../core/constants/guide';
import { HOUSE_ADOPT } from '../../core/constants/house';
import type { ItemId, WardrobeItem } from '../../core/types';
import { cleanCatNameInput } from '../../selectors/cat';
import type { NextAdoptionView } from '../../selectors/house';
import { Button } from '../kit/Button';
import { Cat, ItemIcon } from '../kit/Cat';
import { CatBody } from '../kit/CatBody';
import { Sheet } from '../kit/Sheet';
import { FishIcon } from '../screens/WardrobeScreen';
import { useGo } from '../useGuide';

export interface AdoptSheetProps {
  open: boolean;
  onClose: () => void;
  adoption: NextAdoptionView | null;
  /** 要領養的是第幾隻（家裡隻數＋1） */
  catNumber: number;
  /** 她已經擁有的毛色 */
  ownedFurs: readonly WardrobeItem[];
  onAdopt: (options: { name?: string; fur?: ItemId }) => void;
}

const PREVIEW_CAT_WIDTH = 120;

/** 領養新小貓的底部抽屜：預覽坐姿、取名字、選已擁有的毛色、看價格或還差幾條小魚乾。 */
export function AdoptSheet({
  open,
  onClose,
  adoption,
  catNumber,
  ownedFurs,
  onAdopt,
}: AdoptSheetProps) {
  const go = useGo();
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [fur, setFur] = useState<ItemId | null>(null);
  // 關閉動畫期間保留剛才顯示的那一隻資訊，避免領養後瞬間跳成下一隻或空白
  const [frozen, setFrozen] = useState<{ adoption: NextAdoptionView; catNumber: number } | null>(
    adoption ? { adoption, catNumber } : null,
  );

  useEffect(() => {
    if (open && adoption) {
      setFrozen({ adoption, catNumber });
    }
  }, [open, adoption, catNumber]);

  useEffect(() => {
    if (open) {
      setDraft('');
      setFur(null);
    }
  }, [open]);

  const shown = open && adoption ? { adoption, catNumber } : frozen;
  if (!shown) return null;

  const { adoption: target, catNumber: num } = shown;
  const defaultName =
    HOUSE_ADOPT.find((entry) => entry.cat === target.cat)?.defaultName ?? CAT_CHARACTER.defaultName;
  const title = `領養第 ${num} 隻小貓`;
  const cleaned = cleanCatNameInput(draft);
  const canAfford = target.short === 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canAfford) return;
    onAdopt({
      ...(cleaned !== null ? { name: draft } : {}),
      ...(fur !== null ? { fur } : {}),
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form className="cb-stack-sm cb-adopt-form" onSubmit={handleSubmit}>
        <h2 className="cb-adopt-title">{title}</h2>

        <div className="cb-adopt-preview">
          <CatBody
            pose="sit"
            outfit={fur ? { fur } : {}}
            width={PREVIEW_CAT_WIDTH}
          />
        </div>

        <div className="cb-field">
          <label className="cb-field-label" htmlFor={inputId}>
            名字（最多 {CAT_NAME_MAX} 個字，留空叫「{defaultName}」）
          </label>
          <input
            id={inputId}
            type="text"
            className="cb-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={defaultName}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          {cleaned !== null && cleaned !== draft ? (
            <p className="cb-sub cb-m0" aria-live="polite">
              會存成「{cleaned}」。
            </p>
          ) : null}
        </div>

        <div className="cb-field">
          <span className="cb-field-label">毛色</span>
          <div className="cb-adopt-furs" role="group" aria-label="挑選毛色">
            <button
              type="button"
              className={`cb-adopt-fur cb-press ${fur === null ? 'is-selected' : ''}`.trim()}
              aria-pressed={fur === null}
              onClick={() => setFur(null)}
            >
              <span className="cb-adopt-fur-icon">
                <Cat size={34} interactive={false} outfit={{}} />
              </span>
              <span className="cb-adopt-fur-name">原本的樣子</span>
            </button>
            {ownedFurs.map((item) => {
              const active = fur === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`cb-adopt-fur cb-press ${active ? 'is-selected' : ''}`.trim()}
                  aria-pressed={active}
                  onClick={() => setFur(item.id)}
                >
                  <span className="cb-adopt-fur-icon">
                    <ItemIcon id={item.id} size={34} />
                  </span>
                  <span className="cb-adopt-fur-name">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="cb-adopt-cost">
          <span className="cb-sub">領養費用</span>
          {target.price === 0 ? (
            <strong className="cb-adopt-free">免費</strong>
          ) : (
            <strong className="cb-wd-tier-fish cb-num-tabular">
              <FishIcon size={16} />
              {target.price}
            </strong>
          )}
        </div>

        {canAfford ? (
          <Button type="submit">帶牠回家</Button>
        ) : (
          <div className="cb-adopt-short" role="status">
            <p className="cb-sub-strong cb-m0">
              還差 {target.short} 條小魚乾，再刷幾題就能帶牠回家！
            </p>
            <Button
              variant="butter"
              className="cb-adopt-go-btn"
              onClick={() => {
                onClose();
                go(GUIDE.fishShort);
              }}
            >
              去刷題
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
