import { useEffect, useState } from 'react';
import { dispatch } from '../../core/commands';
import {
  ROUND_COUNT_DEFAULT,
  ROUND_COUNT_MAX,
  ROUND_COUNT_MIN,
  ROUND_COUNT_PRESETS,
  ROUND_COUNT_STEP,
  SECONDS_PER_QUESTION,
} from '../../core/constants/round';
import type { RoundConfig, RoundMode, SubjectKey } from '../../core/types';
import type { World } from '../../core/world';
import { activeBank, availableCount, getSettings } from '../../selectors';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import { PawPicker } from '../kit/PawPicker';
import { Stepper } from '../kit/Stepper';
import { Switch } from '../kit/Switch';
import { useWorld } from '../useWorld';

const MODE_OPTIONS: ReadonlyArray<{ value: RoundMode; label: string }> = [
  { value: 'mixed', label: '混合' },
  { value: 'new', label: '沒刷過' },
  { value: 'wrong', label: '只刷錯題' },
  { value: 'due', label: '到期複習' },
];

function clampCount(value: number): number {
  return Math.min(ROUND_COUNT_MAX, Math.max(ROUND_COUNT_MIN, value));
}

export interface DrillSetupScreenProps {
  world: World;
}

/** 回合設定畫面：題數步進＋貓掌快選、多選科目、出題模式、快刷開關與可刷題數提示。 */
export function DrillSetupScreen({ world }: DrillSetupScreenProps) {
  useWorld(world);
  const bank = activeBank(world);
  const settings = getSettings(world);

  const initialLast =
    settings.lastRound && bank && settings.lastRound.bankId === bank.id
      ? settings.lastRound
      : null;

  const validSubjectSet = new Set(bank?.subjects.map((s) => s.key) ?? []);

  const [count, setCount] = useState<number>(() =>
    initialLast ? clampCount(initialLast.count) : ROUND_COUNT_DEFAULT,
  );
  const [subjectKeys, setSubjectKeys] = useState<SubjectKey[]>(() =>
    initialLast ? initialLast.subjectKeys.filter((k) => validSubjectSet.has(k)) : [],
  );
  const [mode, setMode] = useState<RoundMode>(() => initialLast?.mode ?? 'mixed');
  const [fast, setFast] = useState<boolean>(() => initialLast?.fast ?? true);

  useEffect(() => {
    if (!bank) return;
    setSubjectKeys((prev) => prev.filter((k) => bank.subjects.some((s) => s.key === k)));
  }, [bank]);

  if (!bank) {
    return (
      <div className="cb-stack">
        <h1>刷題</h1>
        <Card>
          <p className="cb-sub">目前沒有可用的題庫。</p>
        </Card>
      </div>
    );
  }

  const config: RoundConfig = {
    bankId: bank.id,
    subjectKeys,
    count,
    mode,
    fast,
  };

  const now = new Date();
  const avail = availableCount(world, config, now);
  const actualCount = Math.min(count, avail);
  const estMinutes = Math.max(1, Math.round((actualCount * SECONDS_PER_QUESTION) / 60));

  const toggleAllSubjects = () => {
    setSubjectKeys([]);
  };

  const toggleSubject = (key: SubjectKey) => {
    setSubjectKeys((prev) => {
      const exists = prev.includes(key);
      const next = exists ? prev.filter((k) => k !== key) : [...prev, key];
      if (next.length === 0 || next.length >= bank.subjects.length) {
        return [];
      }
      return next;
    });
  };

  const handleStart = () => {
    if (avail === 0) return;
    dispatch(world, { type: 'startRound', config });
  };

  const startLabel =
    avail === 0
      ? '這個範圍目前沒有題目'
      : count > avail
        ? `開始刷 ${avail} 題（全部）`
        : `開始刷 ${count} 題`;

  return (
    <div className="cb-stack">
      <h1>刷題</h1>

      <Card className="cb-setup-card">
        <div className="cb-row cb-center">
          <Cat size={64} mood="yay" interactive />
          <span className="cb-setup-prompt">這回合要刷幾題？</span>
        </div>
        <Stepper
          value={count}
          min={ROUND_COUNT_MIN}
          max={ROUND_COUNT_MAX}
          step={ROUND_COUNT_STEP}
          subtitle={avail > 0 ? `大概 ${estMinutes} 分鐘` : '請調整篩選範圍'}
          onChange={setCount}
        />
        <PawPicker presets={ROUND_COUNT_PRESETS} value={count} onChange={setCount} />
      </Card>

      <section className="cb-section">
        <h2>刷哪一科（可複選）</h2>
        <div className="cb-pick-grid" role="group" aria-label="選擇科目">
          <Chip
            tone="mint"
            active={subjectKeys.length === 0}
            onClick={toggleAllSubjects}
          >
            全部
          </Chip>
          {bank.subjects.map((subject) => (
            <Chip
              key={subject.key}
              tone="mint"
              active={subjectKeys.includes(subject.key)}
              onClick={() => toggleSubject(subject.key)}
            >
              {subject.short}
            </Chip>
          ))}
        </div>
      </section>

      <section className="cb-section">
        <h2>出題模式</h2>
        <div className="cb-pick-grid" role="group" aria-label="出題模式">
          {MODE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              tone="butter"
              active={mode === opt.value}
              onClick={() => setMode(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </section>

      <Card className="cb-row">
        <div className="cb-grow">
          <strong>快刷模式</strong>
          <div className="cb-sub">答對自動下一題，答錯才停下來看口訣</div>
        </div>
        <Switch checked={fast} onChange={setFast} ariaLabel="快刷模式" />
      </Card>

      <div className="cb-avail-hint" aria-live="polite">
        這個範圍有 <b>{avail}</b> 題可刷
      </div>

      <Button onClick={handleStart} disabled={avail === 0}>
        {startLabel}
      </Button>
    </div>
  );
}
