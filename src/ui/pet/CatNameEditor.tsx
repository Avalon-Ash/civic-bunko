import { useEffect, useId, useState, type FormEvent } from 'react';
import { dispatch } from '../../core/commands';
import { CAT_NAME_MAX } from '../../core/constants/cat';
import { CAT_CHARACTER } from '../../core/constants/catLines';
import { HOUSE_ADOPT } from '../../core/constants/house';
import type { CatId } from '../../core/types';
import type { World } from '../../core/world';
import { cleanCatNameInput } from '../../selectors/cat';
import { houseCats } from '../../selectors/house';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { useWorld } from '../useWorld';

export interface CatNameEditorProps {
  world: World;
  /** 指定要改哪一隻的名字；沒給就改家裡第一隻 */
  cat?: CatId;
}

/**
 * 小貓的名字牌：取了名字就顯示名字，沒取顯示「預設名・取名字」；點了跳出對話框輸入。
 * 留空存檔＝改回預設稱呼。名字連同改動時間跨裝置同步（較新的那次改動留下）。
 */
export function CatNameEditor({ world, cat }: CatNameEditorProps) {
  useWorld(world);
  const cats = houseCats(world);
  const info = (cat ? cats.find((c) => c.id === cat) : cats[0]) ?? cats[0];
  const targetId = info?.id;
  const current = info?.named ?? null;
  const defaultName =
    HOUSE_ADOPT.find((entry) => entry.cat === targetId)?.defaultName ?? CAT_CHARACTER.defaultName;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  /** 存起來會變成什麼（清理、截短之後）；null＝改回預設稱呼 */
  const cleaned = cleanCatNameInput(draft);

  // 切換選中的小貓時關掉對話框，避免改錯隻
  useEffect(() => {
    setOpen(false);
  }, [targetId]);

  const start = () => {
    setDraft(current ?? '');
    setOpen(true);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    dispatch(world, { type: 'setCatName', name: draft, ...(targetId ? { cat: targetId } : {}) });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="cb-wd-name cb-press"
        onClick={start}
        aria-label={current ? `改名字（現在叫${current}）` : `幫${defaultName}取名字`}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
        {current ?? `${defaultName}・取名字`}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={current ? `幫${current}改名字` : `幫${defaultName}取名字`}>
        <form className="cb-stack-sm" onSubmit={save}>
          <div className="cb-field">
            <label className="cb-field-label" htmlFor={inputId}>
              名字（最多 {CAT_NAME_MAX} 個字）
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
              autoFocus
            />
          </div>
          <p className="cb-sub cb-m0" aria-live="polite">
            {cleaned === null
              ? `留空的話，就叫回「${defaultName}」。`
              : cleaned === draft
                ? '牠跟你說話時會用這個名字；有設同步的話，其他裝置同步後也會跟著改。'
                : `會存成「${cleaned}」。`}
          </p>
          <div className="cb-acts">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit">存起來</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
