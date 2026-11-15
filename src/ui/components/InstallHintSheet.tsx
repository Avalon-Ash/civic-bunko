import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Sheet } from '../kit/Sheet';

export interface InstallHintSheetProps {
  open: boolean;
  onLater: () => void;
  onDismissForever: () => void;
}

function ShareIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3v11m0-11l-4 4m4-4l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AddToHomeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M12 8v8M8 12h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeAppIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5"
        fill="var(--pink)"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M8.5 11.5l1-3.5 2.5 2 2.5-2 1 3.5a4 4 0 0 1-3.5 5.5 4 4 0 0 1-3.5-5.5z"
        fill="var(--surface-raised)"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STEPS = [
  {
    no: '1',
    title: '點 Safari 下方的分享鈕',
    tone: 'butter' as const,
    icon: <ShareIcon />,
  },
  {
    no: '2',
    title: '選「加入主畫面」',
    tone: 'mint' as const,
    icon: <AddToHomeIcon />,
  },
  {
    no: '3',
    title: '以後從主畫面的圖示打開',
    tone: 'pink' as const,
    icon: <HomeAppIcon />,
  },
] as const;

/** 加到主畫面引導抽屜：說明原因與三步驟圖卡，提供「知道了」與「等一下再說」。 */
export function InstallHintSheet({
  open,
  onLater,
  onDismissForever,
}: InstallHintSheetProps) {
  return (
    <Sheet open={open} onClose={onLater} title="加到主畫面">
      <div className="cb-stack">
        <div className="cb-stack-xs">
          <strong className="cb-install-heading">加到主畫面，刷題進度才不會被 Safari 清掉。</strong>
          <p className="cb-sub cb-m0">
            Safari 會清除 7 天沒開啟網站的本機資料；加到主畫面後進度會更安全，兩邊資料不互通喔。
          </p>
        </div>

        <div className="cb-install-steps">
          {STEPS.map((step) => (
            <Card key={step.no} className="cb-install-step">
              <span className={`cb-install-icon cb-tone-${step.tone}`} aria-hidden="true">
                {step.icon}
              </span>
              <div className="cb-grow">
                <div className="cb-sub">步驟 {step.no}</div>
                <strong>{step.title}</strong>
              </div>
            </Card>
          ))}
        </div>

        <div className="cb-acts">
          <Button variant="ghost" onClick={onLater}>
            等一下再說
          </Button>
          <Button variant="primary" onClick={onDismissForever}>
            知道了
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
