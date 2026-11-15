import type { Bank, Enrich, PaperFile } from '../core/types';
import type { World } from '../core/world';

/** 將題庫清單、試卷檔案與可選加工資料載入 world，並依題庫發出 bankLoaded 事件。 */
export function loadBank(
  world: World,
  banks: Bank[],
  files: PaperFile[],
  enrichList: Enrich[] = [],
): void {
  const bankMap = new Map(world.banks.map((b) => [b.id, b]));
  for (const bank of banks) {
    bankMap.set(bank.id, bank);
  }
  world.banks = [...bankMap.values()];

  for (const file of files) {
    world.papers.set(file.paper.id, file.paper);
    for (const group of file.groups) {
      world.groups.set(group.id, group);
    }
    for (const question of file.questions) {
      world.questions.set(question.id, question);
    }
  }

  for (const item of enrichList) {
    world.enrich.set(item.id, item);
  }

  for (const bank of banks) {
    let questionCount = 0;
    for (const question of world.questions.values()) {
      const paper = world.papers.get(question.paperId);
      if (paper?.bankId === bank.id) {
        questionCount += 1;
      }
    }
    world.bus.emit({
      type: 'bankLoaded',
      bankId: bank.id,
      questionCount,
    });
  }
}
