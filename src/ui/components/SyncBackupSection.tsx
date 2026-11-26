import { useEffect, useId, useRef, useState } from 'react';
import { dispatch } from '../../core/commands';
import type { SyncStatus } from '../../core/types';
import type { World } from '../../core/world';
import { progressOverview } from '../../selectors/backup';
import { getSyncState } from '../../selectors/sync';
import { exportProgress } from '../../systems/persistence';
import { encodeSyncCode, validateSyncCredentials } from '../../systems/syncCode';
import { Button } from '../kit/Button';
import { Cat } from '../kit/Cat';
import { Collapse } from '../kit/Collapse';
import { Dialog } from '../kit/Dialog';
import { Sheet } from '../kit/Sheet';
import { Toast } from '../kit/Toast';
import { guideAnchor, useGuidePreset } from '../useGuide';

/** 同步狀態翻成收合列摘要的一句話（SSOT：只定義在這裡）。 */
const SYNC_SUMMARY: Readonly<Record<SyncStatus, string>> = {
  off: '還沒開啟',
  idle: '已同步',
  syncing: '同步中',
  error: '出錯了',
};

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

function formatSyncTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

async function copyTextWithFallback(
  text: string,
  textarea: HTMLTextAreaElement | null,
  successMessage: string,
  onMessage: (msg: string) => void,
): Promise<void> {
  const selectFallback = () => {
    if (textarea) {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
    }
    onMessage('無法自動複製，已全選文字請手動複製');
  };

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      onMessage(successMessage);
      return;
    }
    selectFallback();
  } catch {
    selectFallback();
  }
}

export interface SyncBackupSectionProps {
  world: World;
}

/** 集章頁最下方的「同步與備份」：私人 repo 同步、產生同步碼、手動匯出匯入與清除進度。 */
export function SyncBackupSection({ world }: SyncBackupSectionProps) {
  const overview = progressOverview(world);
  const sync = getSyncState(world);
  const [syncOpen, setSyncOpen] = useState(sync.status === 'error');

  useEffect(() => {
    if (sync.status === 'error') setSyncOpen(true);
  }, [sync.status]);

  useGuidePreset('open-sync', () => setSyncOpen(true));

  const ownerInputId = useId();
  const repoInputId = useId();
  const tokenInputId = useId();

  // 同步設定與產生同步碼狀態（權杖只留在元件 state，不寫進儲存）
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  const [syncCodeText, setSyncCodeText] = useState('');
  const [syncSheetHint, setSyncSheetHint] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [genOwner, setGenOwner] = useState('');
  const [genRepo, setGenRepo] = useState('');
  const [genToken, setGenToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');

  // 手動備份狀態
  const [exportOpen, setExportOpen] = useState(false);
  const [exportJson, setExportJson] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const exportTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const generatedTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const syncConfigured =
    sync.status === 'idle' ||
    sync.status === 'syncing' ||
    (sync.status === 'error' && (sync.lastSyncedAt !== null || sync.error !== '同步碼格式不對'));

  const lastSyncLabel = formatSyncTime(sync.lastSyncedAt);

  const handleOpenSyncSheet = () => {
    setSyncCodeText('');
    setSyncSheetHint(null);
    setSyncSheetOpen(true);
  };

  const handlePasteSyncCode = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text.trim().length > 0) {
          setSyncCodeText(text.trim());
          setSyncSheetHint(null);
          return;
        }
      }
      setSyncSheetHint('無法自動貼上，請長按上方輸入框手動貼上');
    } catch {
      setSyncSheetHint('無法自動貼上，請長按上方輸入框手動貼上');
    }
  };

  const handleStartSync = () => {
    dispatch(world, { type: 'setSyncCode', code: syncCodeText });
    const nextSync = getSyncState(world);
    if (nextSync.status === 'error' && nextSync.error === '同步碼格式不對') {
      setSyncSheetHint('同步碼格式不對，請確認有完整貼上');
      return;
    }
    setSyncSheetOpen(false);
    setSyncCodeText('');
    setSyncSheetHint(null);
    setToast('同步開啟了');
  };

  const handleRetrySync = () => {
    if (!syncConfigured) {
      handleOpenSyncSheet();
      return;
    }
    dispatch(world, { type: 'syncNow' });
  };

  const handleConfirmDisable = () => {
    dispatch(world, { type: 'disableSync' });
    setDisableOpen(false);
    setToast('已停止同步');
  };

  const handleGenerateCode = () => {
    const cred = validateSyncCredentials(genOwner.trim(), genRepo.trim(), genToken.trim());
    if (!cred) {
      setGenError('請填寫 GitHub 帳號、repo 名稱與權杖（帳號與 repo 不可含 / 或空白）');
      setGeneratedCode('');
      return;
    }
    setGenError(null);
    setGeneratedCode(encodeSyncCode(cred));
  };

  const handleCopyGenerated = () =>
    copyTextWithFallback(
      generatedCode,
      generatedTextareaRef.current,
      '已複製同步碼',
      setToast,
    );

  const handleOpenExport = () => {
    setExportJson(exportProgress(world));
    setExportOpen(true);
  };

  const handleCopyExport = () =>
    copyTextWithFallback(
      exportJson,
      exportTextareaRef.current,
      '已複製進度備份',
      setToast,
    );

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
    <>
      <Toast message={toast} onDismiss={() => setToast(null)} />

      <Collapse
        title="同步與備份"
        summary={SYNC_SUMMARY[sync.status]}
        open={syncOpen}
        onOpenChange={setSyncOpen}
        {...guideAnchor('stamps-sync')}
      >
        <div className="cb-stack-sm cb-sync-body">
          <div className="cb-sync-status">
            {sync.status === 'off' && <span className="cb-sub-strong">還沒開啟同步</span>}
            {sync.status === 'syncing' && (
              <div className="cb-row">
                <Cat size={36} mood="sleepy" interactive={false} spin className="cb-sync-cat" />
                <strong className="cb-sub-strong">同步中…</strong>
              </div>
            )}
            {sync.status === 'idle' && (
              <strong className="cb-sub-strong">
                {lastSyncLabel ? `已同步・上次 ${lastSyncLabel}` : '已同步'}
              </strong>
            )}
            {sync.status === 'error' && (
              <div className="cb-sync-error-row">
                <span className="cb-sub-strong cb-grow">
                  {sync.error ?? '同步失敗，請稍後再試'}
                </span>
                <Button variant="butter" className="cb-sync-retry-btn" onClick={handleRetrySync}>
                  再試一次
                </Button>
              </div>
            )}
          </div>

          {!syncConfigured ? (
            <Button variant="primary" onClick={handleOpenSyncSheet}>
              貼上同步碼
            </Button>
          ) : (
            <div className="cb-acts">
              <Button
                variant="butter"
                onClick={() => dispatch(world, { type: 'syncNow' })}
                disabled={sync.status === 'syncing'}
              >
                立即同步
              </Button>
              <Button variant="ghost" onClick={() => setDisableOpen(true)}>
                停止同步
              </Button>
            </div>
          )}

          <div className="cb-sync-divider">
            <button
              type="button"
              className="cb-collapse-toggle"
              aria-expanded={genOpen}
              onClick={() => setGenOpen((prev) => !prev)}
            >
              <span>給管理的人：產生同步碼</span>
              <span className="cb-sub">{genOpen ? '收合' : '展開'}</span>
            </button>

            {genOpen && (
              <div className="cb-stack-sm cb-mt-xs">
                <div className="cb-field">
                  <label className="cb-field-label" htmlFor={ownerInputId}>
                    GitHub 帳號或組織
                  </label>
                  <input
                    id={ownerInputId}
                    type="text"
                    className="cb-input"
                    value={genOwner}
                    onChange={(e) => setGenOwner(e.target.value)}
                    placeholder="例如 family-owner"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>

                <div className="cb-field">
                  <label className="cb-field-label" htmlFor={repoInputId}>
                    repo 名稱
                  </label>
                  <input
                    id={repoInputId}
                    type="text"
                    className="cb-input"
                    value={genRepo}
                    onChange={(e) => setGenRepo(e.target.value)}
                    placeholder="例如 civic-progress"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>

                <div className="cb-field">
                  <label className="cb-field-label" htmlFor={tokenInputId}>
                    權杖
                  </label>
                  <div className="cb-input-row">
                    <input
                      id={tokenInputId}
                      type={showToken ? 'text' : 'password'}
                      className="cb-input cb-grow"
                      value={genToken}
                      onChange={(e) => setGenToken(e.target.value)}
                      placeholder="github_pat_..."
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    <Button
                      variant="ghost"
                      className="cb-token-toggle"
                      onClick={() => setShowToken((prev) => !prev)}
                    >
                      {showToken ? '隱藏' : '顯示'}
                    </Button>
                  </div>
                </div>

                {genError && <p className="cb-sub-strong cb-m0">{genError}</p>}

                <Button variant="butter" onClick={handleGenerateCode}>
                  產生
                </Button>

                {generatedCode && (
                  <div className="cb-stack-xs">
                    <textarea
                      ref={generatedTextareaRef}
                      className="cb-textarea"
                      readOnly
                      value={generatedCode}
                      rows={4}
                      aria-label="產生的同步碼"
                    />
                    <Button variant="mint" onClick={handleCopyGenerated}>
                      複製
                    </Button>
                    <p className="cb-sub cb-m0">這串同步碼等於鑰匙，只傳給家人。</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="cb-sync-divider cb-stack-sm">
            <h3 className="cb-subheading">手動備份</h3>

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
          </div>
        </div>
      </Collapse>

      <Sheet open={syncSheetOpen} onClose={() => setSyncSheetOpen(false)} title="貼上同步碼">
        <div className="cb-stack-sm">
          <strong className="cb-install-heading">貼上同步碼</strong>
          <p className="cb-sub cb-m0">把家人傳給你的同步碼貼在這裡</p>
          <textarea
            className="cb-textarea"
            value={syncCodeText}
            onChange={(e) => {
              setSyncCodeText(e.target.value);
              setSyncSheetHint(null);
            }}
            rows={5}
            placeholder="cb1...."
            aria-label="同步碼"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {syncSheetHint && <p className="cb-sub-strong cb-m0">{syncSheetHint}</p>}
          <div className="cb-acts">
            <Button variant="mint" onClick={handlePasteSyncCode}>
              貼上
            </Button>
            <Button variant="primary" onClick={handleStartSync}>
              開始同步
            </Button>
          </div>
        </div>
      </Sheet>

      <Dialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="確定要停止同步嗎？"
      >
        <div className="cb-stack-sm">
          <p className="cb-m0">會從這台裝置移除同步碼，進度不會刪。</p>
          <div className="cb-acts">
            <Button variant="ghost" onClick={() => setDisableOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={handleConfirmDisable}>
              停止同步
            </Button>
          </div>
        </div>
      </Dialog>

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
    </>
  );
}
