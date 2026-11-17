import type { CSSProperties } from 'react';
import type { EnrichVisual } from '../../core/types';

export interface VisualProps {
  visual: EnrichVisual;
  className?: string;
}

const STEP_DELAY_MS = 60;

function stepDelayStyle(order: number): CSSProperties {
  return { '--step-delay': `${order * STEP_DELAY_MS}ms` } as CSSProperties;
}

/** 加工小圖元件：支援流程圖（flow）與雙欄對比卡（versus），出現時步驟依序彈入。 */
export function Visual({ visual, className = '' }: VisualProps) {
  if (visual.kind === 'flow') {
    let stepOrder = 0;

    return (
      <div className={`cb-pic ${className}`.trim()}>
        {visual.lanes.map((lane, laneIdx) => (
          <div
            key={laneIdx}
            className={`cb-lane ${laneIdx > 0 ? 'is-off' : ''}`.trim()}
          >
            {lane.steps.map((step, idx) => {
              const delayStyle = stepDelayStyle(stepOrder);
              stepOrder += 1;

              return (
                <span key={`${laneIdx}-${idx}`} className="cb-lane-seg">
                  {idx > 0 && (
                    <span
                      className="cb-lane-arrow cb-vis-step"
                      style={delayStyle}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  )}
                  <span
                    className={`cb-lane-step is-${step.tone} cb-vis-step`}
                    style={delayStyle}
                  >
                    {step.text}
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  const rightCardOrder = 1 + visual.left.points.length;

  return (
    <div className={`cb-pic ${className}`.trim()}>
      <div className="cb-versus">
        <div
          className="cb-versus-card is-left cb-vis-step"
          style={stepDelayStyle(0)}
        >
          <strong className="cb-versus-title">{visual.left.title}</strong>
          <ul className="cb-versus-list">
            {visual.left.points.map((point, idx) => (
              <li
                key={idx}
                className="cb-vis-step"
                style={stepDelayStyle(1 + idx)}
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div
          className="cb-versus-card is-right cb-vis-step"
          style={stepDelayStyle(rightCardOrder)}
        >
          <strong className="cb-versus-title">{visual.right.title}</strong>
          <ul className="cb-versus-list">
            {visual.right.points.map((point, idx) => (
              <li
                key={idx}
                className="cb-vis-step"
                style={stepDelayStyle(rightCardOrder + 1 + idx)}
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
