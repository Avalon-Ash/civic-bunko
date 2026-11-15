import { useRef, useState } from 'react';
import { dispatch } from '../../core/commands';
import type { World } from '../../core/world';
import { activeBank, subjectStats } from '../../selectors';
import { progressOverview } from '../../selectors/backup';
import { exportProgress } from '../../systems/persistence';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Dialog } from '../kit/Dialog';
import { ProgressBar } from '../kit/ProgressBar';
import { Sheet } from '../kit/Sheet';
import { Toast } from '../kit/Toast';
import { useWorld } from '../useWorld';

export interface StampsScreenProps {
  world: World;
  papersLoading?: boolean;
}

function formatLastAnswered(iso: string | null): string {
  if (!iso) return '尚未作答';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '尚未作答';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

/** 集章畫面：顯示各科總題數、已刷題數與答對率，以及最下方的進度備份區塊。 */
export function StampsScreen({ world, papersLoading = false }: StampsScreenProps) {
  useWorld(world);
  const bank = activeBank(world);
  const stats = bank ? subjectStats(world, bank.id) : [];
  const overview = progressOverview(world);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportJson, setExportJson] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const exportTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleOpenExport = () => {
    setExportJson(exportProgress(world));
    setExportOpen(true);
  };

  const selectExportFallback = () => {
    const el = exportTextareaRef.current;
    if (el) {
      el.focus();
      el.select();
      el.setSelectionRange(0, el.value.length);
    }
    setToast('無法自動複製，已全選文字請手動複製');
  };

  const handleCopyExport = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportJson);
        setToast('已複製進度備份');
        return;
      }
      selectExportFallback();
    } catch {
      selectExportFallback();
    }
  };

  const handleImportSubmit = () => {
    try {
      dispatch(world, { type: 'importProgress', json: importText });
      setImportOpen(false);
      setImportText('');
      setToast('進度匯入成功！');
    } catch {
      setToast('匯入失敗：備份格式不正確');
    }
  };

  const handleConfirmReset = () => {
    dispatch(world, { type: 'resetProgress' });
    setResetOpen(false);
    setToast('已清除全部進度');
  };

  return (
    <div className="cb-stack">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      <div className="cb-page-head">
        <h1>集章</h1>
        {papersLoading && <span className="cb-sub">題庫載入中…</span>}
      </div>

      {stats.length > 0 ? (
        <div className="cb-stack-sm">
          {stats.map((stat) => {
            const pct = Math.round(stat.correctRate * 100);
            return (
              <Card key={stat.key} className="cb-stack-xs">
                <div className="cb-row">
                  <strong className="cb-grow">{stat.name}</strong>
                  <span className="cb-sub-strong">
                    {stat.seen > 0 ? `答對率 ${pct}%` : '尚未作答'}
                  </span>
                </div>
                <div className="cb-sub">
                  {papersLoading ? '載入中…' : `已刷 ${stat.seen} / ${stat.total} 題`}
                </div>
                <ProgressBar
                  value={stat.seen}
                  total={Math.max(1, stat.total)}
                  ariaLabel={`${stat.name} 已刷 ${stat.seen} 題，共 ${stat.total} 題`}
                />
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <p className="cb-sub">目前沒有科目統計資料。</p>
        </Card>
      )}

      <section className="cb-section">
        <h2>備份</h2>
        <Card className="cb-stack-sm">
          <div className="cb-backup-meta">
            <div className="cb-backup-row">
              <span className="cb-sub">已刷題數</span>
              <strong className="cb-num-tabular">{overview.seenCount} 題</strong>
            </div>
            <div className="cb-backup-row">
              <span className="cb-sub">上次作答時間</span>
              <strong className="cb-num-tabular">
                {formatLastAnswered(overview.lastAnsweredAt)}
              </strong>
            </div>
          </div>

          <div className="cb-acts">
            <Button variant="butter" onClick={handleOpenExport}>
              匯出進度
            </Button>
            <Button
              variant="mint"
              onClick={() => {
                setImportText('');
                setImportOpen(true);
              }}
            >
              匯入進度
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setResetOpen(true)}>
            清除全部進度
          </Button>
        </Card>
      </section>

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="匯出進度">
        <div className="cb-stack-sm">
          <strong className="cb-install-heading">匯出進度</strong>
          <p className="cb-sub cb-m0">
            複製以下備份文字保存；換裝置或加到主畫面後可貼上還原。
          </p>
          <textarea
            ref={exportTextareaRef}
            className="cb-textarea"
            readOnly
            value={exportJson}
            rows={6}
            aria-label="匯出的進度 JSON"
          />
          <div className="cb-acts">
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              關閉
            </Button>
            <Button variant="primary" onClick={handleCopyExport}>
              複製
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet open={importOpen} onClose={() => setImportOpen(false)} title="匯入進度">
        <div className="cb-stack-sm">
          <strong className="cb-install-heading">匯入進度</strong>
          <p className="cb-sub cb-m0">
            貼上先前匯出的 JSON 備份文字，確認後會取代目前的作答進度。
          </p>
          <textarea
            className="cb-textarea"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder="請貼上備份 JSON..."
            aria-label="貼上要匯入的進度 JSON"
          />
          <div className="cb-acts">
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleImportSubmit}>
              匯入
            </Button>
          </div>
        </div>
      </Sheet>

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="確定要清除全部進度嗎？"
      >
        <div className="cb-stack-sm">
          <p className="cb-m0">
            這會清除所有科目的作答紀錄、已刷題數、連對紀錄與複習排程，且清除後無法復原（畫面主題設定會保留）。
          </p>
          <div className="cb-acts">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleConfirmReset}>
              確認清除
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
