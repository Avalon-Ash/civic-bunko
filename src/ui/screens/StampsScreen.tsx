import type { World } from '../../core/world';
import { activeBank, subjectStats } from '../../selectors';
import { Card } from '../kit/Card';
import { ProgressBar } from '../kit/ProgressBar';
import { useWorld } from '../useWorld';

export interface StampsScreenProps {
  world: World;
}

/** 集章畫面：顯示各科總題數、已刷題數與答對率。 */
export function StampsScreen({ world }: StampsScreenProps) {
  useWorld(world);
  const bank = activeBank(world);
  const stats = bank ? subjectStats(world, bank.id) : [];

  return (
    <div className="cb-stack">
      <h1>集章</h1>
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
                  已刷 {stat.seen} / {stat.total} 題
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
    </div>
  );
}
