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
import {
  POSITIVE_UNLOCK_RATIO,
  READ_PASSES_DEFAULT,
  READ_PASSES_PRESETS,
} from '../../core/constants/study';
import { FREQ_ROUND_COUNT } from '../../core/constants/frequent';
import { WEAK_ROUND_COUNT } from '../../core/constants/weak';
import type { AskFilter, PaperId, RoundConfig, RoundMode, StudyMode, SubjectKey } from '../../core/types';
import type { World } from '../../core/world';
import {
  activeBank,
  askCounts,
  availableCount,
  getSettings,
  positiveCoverage,
} from '../../selectors';
import { examBest, examPapers, type ExamPaperView } from '../../selectors/exam';
import { frequentRoundConfig, frequentTopics } from '../../selectors/frequent';
import { weakRoundConfig, weakSummary } from '../../selectors/weak';
import { formatExamLabel } from '../components/QuestionParts';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Cat } from '../kit/Cat';
import { Chip } from '../kit/Chip';
import { PawPicker } from '../kit/PawPicker';
import { Segmented, type SegmentedOption } from '../kit/Segmented';
import { Sheet } from '../kit/Sheet';
import { Stepper } from '../kit/Stepper';
import { Switch } from '../kit/Switch';
import { useWorld } from '../useWorld';

const STUDY_OPTIONS: readonly SegmentedOption<StudyMode>[] = [
  { value: 'quiz', label: '自己作答' },
  { value: 'read', label: '看答案' },
];

const MODE_OPTIONS: ReadonlyArray<{ value: RoundMode; label: string }> = [
  { value: 'mixed', label: '混合' },
  { value: 'new', label: '沒刷過' },
  { value: 'wrong', label: '只刷錯題' },
  { value: 'due', label: '到期複習' },
];

const READ_MODE_OPTIONS: ReadonlyArray<{ value: RoundMode; label: string }> = MODE_OPTIONS.filter(
  (opt) => opt.value === 'mixed' || opt.value === 'new',
);

function clampCount(value: number): number {
  return Math.min(ROUND_COUNT_MAX, Math.max(ROUND_COUNT_MIN, value));
}

export interface DrillSetupScreenProps {
  world: World;
  papersLoading?: boolean;
}

/** 回合設定畫面：學習方式、題數步進＋貓掌快選、多選科目、題型篩選、看幾遍／出題模式。 */
export function DrillSetupScreen({ world, papersLoading = false }: DrillSetupScreenProps) {
  useWorld(world);
  const bank = activeBank(world);
  const settings = getSettings(world);

  const initialLast =
    settings.lastRound && bank && settings.lastRound.bankId === bank.id
      ? settings.lastRound
      : null;

  const validSubjectSet = new Set(bank?.subjects.map((s) => s.key) ?? []);

  const [study, setStudy] = useState<StudyMode>(() => initialLast?.study ?? 'quiz');
  const [ask, setAsk] = useState<AskFilter>(() => initialLast?.ask ?? 'positive');
  const [passes, setPasses] = useState<number>(() => initialLast?.passes ?? READ_PASSES_DEFAULT);
  const [count, setCount] = useState<number>(() =>
    initialLast ? clampCount(initialLast.count) : ROUND_COUNT_DEFAULT,
  );
  const [subjectKeys, setSubjectKeys] = useState<SubjectKey[]>(() =>
    initialLast ? initialLast.subjectKeys.filter((k) => validSubjectSet.has(k)) : [],
  );
  const [mode, setMode] = useState<RoundMode>(() => {
    const m = initialLast?.mode ?? 'mixed';
    if ((initialLast?.study ?? 'quiz') === 'read' && (m === 'wrong' || m === 'due')) {
      return 'mixed';
    }
    return m;
  });
  // 使用者回饋（2026-11-16）：答對也要看完整口訣卡，不自動跳題，所以不再提供快刷開關。
  const fast = false;
  const [examSheetOpen, setExamSheetOpen] = useState(false);
  const [selectedPaperId, setSelectedPaperId] = useState<PaperId | null>(null);

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

  const papers = examPapers(world, bank.id);
  const selectedPaper = papers.find((p) => p.paperId === selectedPaperId) ?? null;

  const groupedPapers: Array<{ subjectKey: SubjectKey; subjectName: string; items: ExamPaperView[] }> = [];
  const groupIndex = new Map<SubjectKey, number>();
  for (const paper of papers) {
    const existingIdx = groupIndex.get(paper.subjectKey);
    if (existingIdx !== undefined) {
      groupedPapers[existingIdx]?.items.push(paper);
    } else {
      groupIndex.set(paper.subjectKey, groupedPapers.length);
      groupedPapers.push({
        subjectKey: paper.subjectKey,
        subjectName: paper.subjectName,
        items: [paper],
      });
    }
  }

  const effectiveMode: RoundMode =
    study === 'read' && (mode === 'wrong' || mode === 'due') ? 'mixed' : mode;

  const config: RoundConfig = {
    bankId: bank.id,
    subjectKeys,
    count,
    mode: effectiveMode,
    fast,
    study,
    ask,
    passes,
  };

  const now = new Date();
  const avail = availableCount(world, config, now);
  const actualCount = Math.min(count, avail);
  const estMinutes = Math.max(1, Math.round((actualCount * SECONDS_PER_QUESTION) / 60));
  const counts = askCounts(world, { bankId: bank.id, subjectKeys });
  const totalAskCount = counts.positive + counts.negative;
  const coverage = positiveCoverage(world, bank.id, subjectKeys);
  const showUnlockHint = !papersLoading && coverage >= POSITIVE_UNLOCK_RATIO && ask === 'positive';
  const weakInfo = weakSummary(world, bank.id);
  const weakConfig = weakRoundConfig(world, bank.id);
  const weakAvail = weakConfig ? availableCount(world, weakConfig, now) : 0;
  const weakCount = Math.min(WEAK_ROUND_COUNT, weakAvail);
  const weakReady = !papersLoading && weakInfo.ready && weakConfig !== null && weakAvail > 0;
  const freqTopicCount = frequentTopics(world, bank.id).length;
  const freqConfig = frequentRoundConfig(world, bank.id);
  const freqAvail = freqConfig ? availableCount(world, freqConfig, now) : 0;
  const freqCount = Math.min(FREQ_ROUND_COUNT, freqAvail);
  const freqReady = !papersLoading && freqConfig !== null && freqAvail > 0;

  const handleStudyChange = (nextStudy: StudyMode) => {
    setStudy(nextStudy);
    if (nextStudy === 'read' && (mode === 'wrong' || mode === 'due')) {
      setMode('mixed');
    }
  };

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
    if (papersLoading || avail === 0) return;
    dispatch(world, { type: 'startRound', config });
  };

  const handleOpenExamSheet = () => {
    if (papersLoading || papers.length === 0) return;
    setSelectedPaperId(null);
    setExamSheetOpen(true);
  };

  const handleStartExam = () => {
    if (papersLoading || !selectedPaper) return;
    dispatch(world, {
      type: 'startRound',
      config: {
        bankId: bank.id,
        subjectKeys: [selectedPaper.subjectKey],
        count: selectedPaper.count,
        mode: 'mixed',
        fast: false,
        study: 'quiz',
        ask: 'all',
        passes: 1,
        exam: {
          paperId: selectedPaper.paperId,
          minutes: selectedPaper.minutes,
        },
      },
    });
    setExamSheetOpen(false);
  };

  const handleStartWeakRound = () => {
    if (!weakReady || !weakConfig) return;
    dispatch(world, { type: 'startRound', config: weakConfig });
  };

  const handleStartFreqRound = () => {
    if (!freqReady || !freqConfig) return;
    dispatch(world, { type: 'startRound', config: freqConfig });
  };

  const verb = study === 'read' ? '看' : '刷';
  const startLabel = papersLoading
    ? '題庫載入中…'
    : avail === 0
      ? '這個範圍目前沒有題目'
      : count > avail
        ? `開始${verb} ${avail} 題（全部）`
        : `開始${verb} ${count} 題`;

  const askOptions: ReadonlyArray<{ value: AskFilter; label: string }> = [
    { value: 'positive', label: papersLoading ? '正向題' : `正向題 ${counts.positive}` },
    { value: 'all', label: papersLoading ? '全部' : `全部 ${totalAskCount}` },
    { value: 'negative', label: papersLoading ? '反向題' : `反向題 ${counts.negative}` },
  ];

  const visibleModeOptions = study === 'read' ? READ_MODE_OPTIONS : MODE_OPTIONS;

  return (
    <div className="cb-stack">
      <h1>刷題</h1>

      <Card
        tone="butter"
        className="cb-exam-entry"
        onClick={handleOpenExamSheet}
        disabled={papersLoading || papers.length === 0}
      >
        <div className="cb-grow">
          <strong className="cb-exam-entry-title">模擬考：整份考卷、計時、交卷才看答案</strong>
          <span className="cb-sub cb-block">
            {papersLoading
              ? '試卷載入中…'
              : papers.length > 0
                ? `共 ${papers.length} 份官方歷屆試卷可選`
                : '目前沒有可用的試卷'}
          </span>
        </div>
        <span className="cb-go">選考卷</span>
      </Card>

      <div className="cb-quick-rounds">
        <Card
          tone="mint"
          className="cb-quick-card"
          onClick={handleStartWeakRound}
          disabled={!weakReady}
        >
          <strong className="cb-quick-title">弱點回合</strong>
          <span className="cb-sub cb-block">
            {papersLoading
              ? '題庫載入中…'
              : weakReady
                ? `你最常錯的 ${weakInfo.topicCount} 個考點・${weakCount} 題`
                : '再多刷幾題就會開放'}
          </span>
        </Card>

        <Card
          tone="pink"
          className="cb-quick-card"
          onClick={handleStartFreqRound}
          disabled={!freqReady}
        >
          <strong className="cb-quick-title">高頻回合</strong>
          <span className="cb-sub cb-block">
            {papersLoading
              ? '題庫載入中…'
              : freqReady
                ? `每科最常考的 ${freqTopicCount} 個考點・${freqCount} 題`
                : '目前沒有可用的題目'}
          </span>
        </Card>
      </div>

      <section className="cb-section">
        <h2>怎麼刷</h2>
        <Segmented
          options={STUDY_OPTIONS}
          value={study}
          onChange={handleStudyChange}
          ariaLabel="怎麼刷"
          className="cb-seg-fill"
        />
      </section>

      <Card className="cb-setup-card">
        <div className="cb-row cb-center">
          <Cat size={64} mood="yay" interactive />
          <span className="cb-setup-prompt">
            {study === 'read' ? '這批要看幾題？' : '這回合要刷幾題？'}
          </span>
        </div>
        <Stepper
          value={count}
          min={ROUND_COUNT_MIN}
          max={ROUND_COUNT_MAX}
          step={ROUND_COUNT_STEP}
          subtitle={
            avail > 0
              ? study === 'read'
                ? `${actualCount} 題 × ${passes} 遍`
                : `大概 ${estMinutes} 分鐘`
              : '請調整篩選範圍'
          }
          onChange={setCount}
        />
        <PawPicker presets={ROUND_COUNT_PRESETS} value={count} onChange={setCount} />
      </Card>

      {study === 'read' && (
        <section className="cb-section">
          <h2>看幾遍</h2>
          <div className="cb-pick-grid" role="group" aria-label="看幾遍">
            {READ_PASSES_PRESETS.map((preset) => (
              <Chip
                key={preset}
                tone="mint"
                active={passes === preset}
                onClick={() => setPasses(preset)}
              >
                {preset} 遍
              </Chip>
            ))}
          </div>
        </section>
      )}

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
        <h2>題型</h2>
        <div className="cb-pick-grid" role="group" aria-label="題型">
          {askOptions.map((opt) => (
            <Chip
              key={opt.value}
              tone="butter"
              active={ask === opt.value}
              onClick={() => setAsk(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
        <p className="cb-sub cb-m0">正向題＝問『哪個對』；反向題＝問『哪個錯』，等熟了再加。</p>
      </section>

      {showUnlockHint && (
        <Card tone="mint" className="cb-stack-sm">
          <div className="cb-row">
            <Cat size={54} mood="yay" interactive />
            <p className="cb-sub-strong cb-m0 cb-grow">
              正向題已經看過六成，可以試試加入反向題了
            </p>
          </div>
          <Button variant="butter" onClick={() => setAsk('all')}>
            加入反向題
          </Button>
        </Card>
      )}

      <section className="cb-section">
        <h2>出題模式</h2>
        <div className="cb-pick-grid" role="group" aria-label="出題模式">
          {visibleModeOptions.map((opt) => (
            <Chip
              key={opt.value}
              tone="butter"
              active={effectiveMode === opt.value}
              onClick={() => setMode(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </section>


      {study !== 'read' && (
      <Card className="cb-row cb-switch-card">
        <div className="cb-grow">
          <strong className="cb-block">選項打亂</strong>
          <span className="cb-sub">每題四個選項換位置，代號不變</span>
        </div>
        <Switch
          checked={Boolean(settings.shuffleOptions)}
          onChange={(on) => dispatch(world, { type: 'setShuffleOptions', on })}
          ariaLabel="選項打亂"
        />
      </Card>
      )}

      <div className="cb-avail-hint" aria-live="polite">
        {papersLoading ? (
          '題庫載入中…'
        ) : (
          <>
            這個範圍有 <b>{avail}</b> 題可{verb}
          </>
        )}
      </div>

      <div className="cb-start-dock">
        <Button onClick={handleStart} disabled={papersLoading || avail === 0}>
          {startLabel}
        </Button>
      </div>

      <Sheet
        open={examSheetOpen}
        onClose={() => setExamSheetOpen(false)}
        title="選擇模擬考試卷"
      >
        <div className="cb-stack-sm">
          <strong className="cb-install-heading">選擇模擬考試卷</strong>
          <p className="cb-sub cb-m0">照官方題號依序作答，交卷後才看分數與解析。</p>

          <div className="cb-stack-sm">
            {groupedPapers.map((group) => (
              <section key={group.subjectKey} className="cb-stack-xs">
                <h3 className="cb-subheading">{group.subjectName}</h3>
                <div className="cb-stack-xs" role="group" aria-label={group.subjectName}>
                  {group.items.map((paper) => {
                    const active = selectedPaperId === paper.paperId;
                    const best = examBest(world, paper.paperId);
                    return (
                      <button
                        key={paper.paperId}
                        type="button"
                        aria-pressed={active}
                        className={`cb-card cb-press cb-exam-paper-btn ${active ? 'is-selected' : ''}`.trim()}
                        onClick={() => setSelectedPaperId(paper.paperId)}
                      >
                        <span className="cb-grow">
                          {paper.year} 年{formatExamLabel(paper.exam)}・{paper.count} 題・
                          {paper.minutes} 分鐘
                        </span>
                        {(best !== null || active) && (
                          <span className="cb-exam-paper-meta">
                            {best !== null && (
                              <span className="cb-chip cb-chip-plain cb-num-tabular">
                                最高 {best} 分
                              </span>
                            )}
                            {active && <span className="cb-chip cb-chip-mint">已選</span>}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="cb-exam-sheet-foot">
            <Button onClick={handleStartExam} disabled={!selectedPaper}>
              {selectedPaper ? `開始（${selectedPaper.minutes} 分鐘）` : '開始'}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
