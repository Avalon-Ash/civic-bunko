import { useEffect, useRef, useState } from 'react';
import { dispatch } from '../../core/commands';
import type { TopicInfo } from '../../core/types';
import type { World } from '../../core/world';
import { loadTopics } from '../../data/source';
import { resolveTopicLabel } from '../../data/sourceLoader';
import { bilingualOn, paperSubjectName, questionPaper, readView } from '../../selectors';
import { catOutfit, leaderCat } from '../../selectors/house';
import {
  BilingualToggle,
  OptionTextWithZh,
  QuestionVocabCard,
  StemTranslation,
} from '../components/Bilingual';
import { CardLinks } from '../components/cards/CardLinks';
import {
  CHOICES,
  CorrectionBox,
  EnrichCard,
  formatQuestionSource,
  MarkedStem,
  PassageCard,
  TEXT_MODE_OPTIONS,
} from '../components/QuestionParts';
import { Button } from '../kit/Button';
import { Card } from '../kit/Card';
import { Chip } from '../kit/Chip';
import { ProgressBar } from '../kit/ProgressBar';
import { PetRunner } from '../pet/PetRunner';
import { Segmented } from '../kit/Segmented';
import { useWorld } from '../useWorld';

export interface ReadScreenProps {
  world: World;
}

/** 看答案畫面：直接顯示正解與拆解，支援正向／反向題分類呈現、多遍洗牌與滑動換題。 */
export function ReadScreen({ world }: ReadScreenProps) {
  useWorld(world);
  const view = readView(world);

  const [textMode, setTextMode] = useState<'official' | 'plain'>('official');
  const [wrongExpanded, setWrongExpanded] = useState(false);
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [passBanner, setPassBanner] = useState<number | null>(null);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const prevPassRef = useRef<number>(view?.pass ?? 1);

  const questionId = view?.question.id;
  const currentPass = view?.pass ?? 1;
  const currentIndex = view?.index ?? 0;

  useEffect(() => {
    let active = true;
    loadTopics().then((list) => {
      if (active) {
        setTopics(list);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // 換題或換遍時重設原文／白話與錯選項折疊狀態
  useEffect(() => {
    setTextMode('official');
    setWrongExpanded(false);
  }, [questionId, currentPass, currentIndex]);

  // 進入下一遍時閃出「第 N 遍」橫幅
  useEffect(() => {
    if (currentPass > prevPassRef.current) {
      setPassBanner(currentPass);
      prevPassRef.current = currentPass;
      const timer = window.setTimeout(() => setPassBanner(null), 1200);
      return () => window.clearTimeout(timer);
    }
    prevPassRef.current = currentPass;
    return undefined;
  }, [currentPass]);

  if (!view) {
    return null;
  }

  const { question, group, enrich, zh, groupZh, askType, pass, totalPasses, index, total, views } = view;
  const paper = questionPaper(world, question.paperId);
  const outfit = catOutfit(world, leaderCat(world));
  const subjectName = paperSubjectName(world, paper);
  const sourceLabel = formatQuestionSource(world, paper, question.no, subjectName);
  const firstTopic = enrich?.topic[0];
  const topicLabel = firstTopic
    ? resolveTopicLabel(topics, firstTopic)
    : (subjectName ?? '題目');
  const bilingualEnabled = bilingualOn(world);
  const hasZh = Boolean(zh || groupZh);
  const showZh = bilingualEnabled && hasZh;

  const handleNext = () => {
    dispatch(world, { type: 'next' });
  };

  const handleQuit = () => {
    dispatch(world, { type: 'quitRound' });
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (dx < -70 && Math.abs(dy) < 50) {
      handleNext();
    }
  };

  const rightChoices = CHOICES.filter((choice) => question.answer.includes(choice));
  const otherChoices = CHOICES.filter((choice) => !question.answer.includes(choice));
  const slideKey = `${pass}-${index}-${question.id}`;

  return (
    <div
      className="cb-question-layout"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {passBanner !== null && (
        <div className="cb-pass-banner-wrap" aria-live="polite">
          <div className="cb-pass-banner" role="status">
            第 {passBanner} 遍
          </div>
        </div>
      )}

      <div className="cb-q-topbar">
        <ProgressBar
          value={index + 1}
          total={total}
          showCat
          runner={<PetRunner world={world} outfit={outfit} value={index + 1} />}
          ariaLabel={
            totalPasses > 1
              ? `第 ${pass} 遍，第 ${index + 1} 題，共 ${total} 題`
              : `第 ${index + 1} 題，共 ${total} 題`
          }
          className="cb-grow"
        />
        <span className="cb-q-counter">
          {totalPasses > 1 ? `第 ${pass} 遍・` : ''}
          <b>{index + 1}</b> / {total}
        </span>
        <Chip tone="plain" onClick={handleQuit}>
          結束
        </Chip>
      </div>

      <div key={`${slideKey}-stem`} className="cb-q-stem-col cb-read-card-enter">
        <div className="cb-row cb-wrap">
          <Chip tone="butter">{topicLabel}</Chip>
          {question.correction && <Chip tone="orange">官方更正</Chip>}
          <div className="cb-row cb-ml-auto cb-read-top-right">
            {enrich?.plain && (
              <Segmented
                options={TEXT_MODE_OPTIONS}
                value={textMode}
                onChange={setTextMode}
                ariaLabel="題目版本切換"
              />
            )}
            {hasZh && (
              <BilingualToggle
                on={bilingualEnabled}
                onToggle={() => dispatch(world, { type: 'setBilingual', on: !bilingualEnabled })}
              />
            )}
            {views > 0 && (
              <span
                className="cb-view-dots"
                aria-label={`這題看過 ${views} 遍`}
                title={`已看過 ${views} 遍`}
              >
                {views <= 5 ? (
                  Array.from({ length: views }, (_, i) => (
                    <span key={i} className="cb-view-dot" aria-hidden="true" />
                  ))
                ) : (
                  <>
                    <span className="cb-view-dot" aria-hidden="true" />
                    <span className="cb-view-count">{views}</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {group && <PassageCard group={group} groupZh={groupZh} bilingual={showZh} />}

        <p className="cb-stem">
          {textMode === 'plain' && enrich?.plain ? (
            enrich.plain
          ) : (
            <MarkedStem stem={question.stem} marks={enrich?.marks ?? []} />
          )}
        </p>

        {showZh && <StemTranslation stem={zh?.stem} />}

        {askType === 'negative' && (
          <p className="cb-read-ask-hint">這題問的是哪一句錯</p>
        )}

        <div className="cb-mt-sm">
          <Chip tone="plain">{sourceLabel}</Chip>
        </div>

        {question.correction && <CorrectionBox correction={question.correction} />}
      </div>

      <div key={`${slideKey}-opts`} className="cb-q-opts-col cb-stack cb-read-card-enter">
        {askType === 'positive' ? (
          <div className="cb-stack-sm">
            {rightChoices.map((choice) => {
              const idx = CHOICES.indexOf(choice);
              const optText = question.options[idx] ?? '';
              return (
                <Card key={choice} tone="green" className="cb-read-right">
                  <div className="cb-read-opt-row">
                    <span className="cb-opt-key cb-read-key-ok">{choice}</span>
                    <span className="cb-grow cb-read-opt-text">
                      <OptionTextWithZh text={optText} zh={showZh ? zh?.options[choice] : null} />
                    </span>
                  </div>
                </Card>
              );
            })}

            {otherChoices.length > 0 && (
              <Card className="cb-read-wrong-box">
                <button
                  type="button"
                  className="cb-passage-toggle"
                  aria-expanded={wrongExpanded}
                  onClick={() => setWrongExpanded((open) => !open)}
                >
                  <span>
                    另外{otherChoices.length === 3 ? '三個' : ` ${otherChoices.length} 個`}
                    是錯的（點開看）
                  </span>
                  <span className="cb-sub">{wrongExpanded ? '收合' : '展開'}</span>
                </button>
                {wrongExpanded && (
                  <div className="cb-stack-xs cb-mt-sm">
                    {otherChoices.map((choice) => {
                      const idx = CHOICES.indexOf(choice);
                      const optText = question.options[idx] ?? '';
                      return (
                        <div key={choice} className="cb-read-wrong-item">
                          <span className="cb-opt-key cb-read-key-dim">{choice}</span>
                          <span className="cb-grow">
                            <OptionTextWithZh text={optText} zh={showZh ? zh?.options[choice] : null} />
                          </span>
                          <span className="cb-read-wrong-tag">錯</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </div>
        ) : (
          <div className="cb-stack-sm">
            <Card className="cb-stack-xs">
              <strong className="cb-read-group-title cb-read-group-ok">
                這 {otherChoices.length} 句是對的，可以記
              </strong>
              <div className="cb-stack-xs">
                {otherChoices.map((choice) => {
                  const idx = CHOICES.indexOf(choice);
                  const optText = question.options[idx] ?? '';
                  return (
                    <div key={choice} className="cb-read-true-item">
                      <span className="cb-read-check" aria-hidden="true">
                        ✓
                      </span>
                      <span className="cb-opt-key cb-read-key-ok">{choice}</span>
                      <span className="cb-grow">
                        <OptionTextWithZh text={optText} zh={showZh ? zh?.options[choice] : null} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="cb-stack-xs cb-read-false-box">
              <strong className="cb-read-group-title">
                {rightChoices.length > 1 ? '這幾句是錯的' : '這句是錯的'}
              </strong>
              <div className="cb-stack-xs">
                {rightChoices.map((choice) => {
                  const idx = CHOICES.indexOf(choice);
                  const optText = question.options[idx] ?? '';
                  const why = enrich?.options[choice]?.why;
                  return (
                    <div key={choice} className="cb-stack-xs">
                      <div className="cb-read-false-item">
                        <span className="cb-opt-key cb-read-key-dim">{choice}</span>
                        <span className="cb-grow">
                          <span className="cb-read-strike">{optText}</span>
                          {showZh && zh?.options[choice] && (
                            <span className="cb-zh-opt-zh">{zh.options[choice]}</span>
                          )}
                        </span>
                      </div>
                      {why && <p className="cb-read-why">{why}</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {enrich && (
          <EnrichCard
            enrich={enrich}
            tone="butter"
            catMood="idle"
            catOutfit={outfit}
            label={<span className="cb-read-kou-label">口訣記憶</span>}
            extra={<CardLinks world={world} questionId={question.id} />}
          />
        )}

        {showZh && zh && <QuestionVocabCard vocab={zh.vocab} />}
      </div>

      <div className="cb-read-next-wrap">
        <Button onClick={handleNext}>下一題</Button>
      </div>
    </div>
  );
}
