// 圖卡抽屜的「刷這張卡的題」按鈕（docs/plans/comic-cards.md §3-3、ADR 0022）。
import { dispatch } from '../../../core/commands';
import { GUIDE } from '../../../core/constants/guide';
import type { World } from '../../../core/world';
import { cardQuestionIds } from '../../../selectors/cardLinks';
import { Button } from '../../kit/Button';
import { useGo } from '../../useGuide';

export interface CardRoundButtonProps {
  world: World;
  cardId: string;
  /** 開啟回合後的選填回呼（例如關閉抽屜） */
  onStart?: () => void;
  className?: string;
}

/** 有連到官方題才顯示；點了開出這張卡的作答回合並切換到刷題分頁。 */
export function CardRoundButton({ world, cardId, onStart, className = '' }: CardRoundButtonProps) {
  const go = useGo();
  const questionIds = cardQuestionIds(world, cardId);
  if (questionIds.length === 0) {
    return null;
  }

  const handleClick = () => {
    dispatch(world, { type: 'startCardRound', cardId });
    onStart?.();
    go(GUIDE.cardRound);
  };

  return (
    <Button variant="mint" className={className} onClick={handleClick}>
      刷這張卡的題（{questionIds.length} 題）
    </Button>
  );
}
