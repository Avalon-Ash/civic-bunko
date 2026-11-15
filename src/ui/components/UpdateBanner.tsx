import { Button } from '../kit/Button';

export interface UpdateBannerProps {
  onReload: () => void;
}

/** 新版可用提示列：於版面最上方滑下，推開內容而不遮住操作按鈕。 */
export function UpdateBanner({ onReload }: UpdateBannerProps) {
  return (
    <div className="cb-update-banner-wrap" role="region" aria-label="版本更新通知">
      <div className="cb-update-banner" role="status" aria-live="polite">
        <strong className="cb-grow">有新版本了</strong>
        <Button variant="primary" className="cb-update-btn" onClick={onReload}>
          更新
        </Button>
      </div>
    </div>
  );
}
