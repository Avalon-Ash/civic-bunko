import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';

/** 圖卡畫面：先放置「準備中」與角色佔位。 */
export function CardsScreen() {
  return (
    <div className="cb-stack">
      <h1>圖卡</h1>
      <Card className="cb-cards-placeholder">
        <Cat size={96} mood="sleepy" interactive />
        <h2>準備中</h2>
        <p className="cb-sub">考點圖卡與申論架構正在整理中，先去刷題熱身吧！</p>
      </Card>
    </div>
  );
}
