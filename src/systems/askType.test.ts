import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { askTypeOf } from './askType';

describe('askTypeOf', () => {
  it('classifies negative-ask stems as negative', () => {
    const negativeCases = [
      '關於地方自治團體，下列敘述何者錯誤？',
      '下列何者非屬行政處分之要件？',
      '依地方制度法規定，下列何者有誤？',
      '關於公務員懲戒，下列敘述何者不正確？',
      '下列事項何者不在行政程序法適用範圍內？',
      '有關直轄市政府之組織，下列何者不得由自治條例定之？',
      '下列何者不屬於公法人？',
      '下列敘述何者為非？',
    ];

    for (const stem of negativeCases) {
      assert.equal(askTypeOf(stem), 'negative', `Expected negative for: ${stem}`);
    }
  });

  it('classifies positive-ask stems as positive', () => {
    const positiveCases = [
      '下列敘述何者正確？',
      '不服縣政府所為之行政處分，應以何機關為訴願管轄機關？',
      '依憲法增修條文規定，總統發布緊急命令後應於幾日內提交立法院追認？',
      '地方制度法所定之委辦規則，應由何機關核定後發布？',
      '下列何者為行政處分之附款？',
      '公務人員對於服務機關所為之管理措施不服時，得提起何種救濟？',
    ];

    for (const stem of positiveCases) {
      assert.equal(askTypeOf(stem), 'positive', `Expected positive for: ${stem}`);
    }
  });
});
