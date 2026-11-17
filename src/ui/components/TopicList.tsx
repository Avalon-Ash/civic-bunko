import { Button } from '../kit/Button';
import { Card } from '../kit/Card';

export interface TopicListItem {
  id: string;
  subjectShort: string;
  name: string;
  /** 名稱下方的一行說明，例如「答錯 3 次／作答 5 次」 */
  detail: string;
  /** 進度條比例，0–1 */
  ratio: number;
}

export interface TopicListProps {
  items: readonly TopicListItem[];
  /** weak：粉紅條表示錯誤率；freq：綠條表示已刷比例 */
  tone: 'weak' | 'freq';
  onSolo: (topicId: string) => void;
}

/** 考點清單（弱點排行與高頻考點共用）：科目標籤、考點名稱、一行說明、進度條與「只刷這個」。 */
export function TopicList({ items, tone, onSolo }: TopicListProps) {
  return (
    <div className="cb-weak-list">
      {items.map((item) => {
        const ratio = Math.min(1, Math.max(0, item.ratio));
        return (
          <Card key={item.id} className="cb-weak-item">
            <div className="cb-weak-info">
              <div className="cb-weak-head">
                <span className="cb-chip cb-chip-plain cb-weak-tag">{item.subjectShort}</span>
                <strong className="cb-weak-name">{item.name}</strong>
              </div>
              <div className="cb-sub cb-num-tabular">{item.detail}</div>
              <div className="cb-weak-bar" aria-hidden="true">
                <div
                  className={
                    tone === 'freq' ? 'cb-weak-bar-fill cb-freq-bar-fill' : 'cb-weak-bar-fill'
                  }
                  style={{ transform: `scaleX(${ratio})` }}
                />
              </div>
            </div>
            <Button
              variant="butter"
              className="cb-weak-solo-btn"
              onClick={() => onSolo(item.id)}
            >
              只刷這個
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
