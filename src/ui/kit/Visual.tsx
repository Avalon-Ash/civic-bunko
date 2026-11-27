import type { CSSProperties } from 'react';
import type { CardVisual, VisualNode } from '../../core/types';

export interface VisualProps {
  visual: CardVisual;
  className?: string;
}

const STEP_DELAY_MS = 60;

function stepDelayStyle(order: number): CSSProperties {
  return { '--step-delay': `${order * STEP_DELAY_MS}ms` } as CSSProperties;
}

/** 樹狀圖的一層：每個節點一列，via 寫在連下來的線上；子節點縮排、用線接起來（樣式 visual-law.css 的 cb-tree） */
function TreeLevel({ nodes, order }: { nodes: VisualNode[]; order: { n: number } }) {
  return (
    <ul className="cb-tree-level">
      {nodes.map((node, i) => {
        const delay = stepDelayStyle(order.n++);
        return (
          <li key={i} className="cb-tree-item">
            <span className="cb-tree-row cb-vis-step" style={delay}>
              {node.via ? <span className="cb-tree-via">{node.via}</span> : null}
              <span className={`cb-tree-node is-${node.tone ?? 'plain'}`}>
                <span className="cb-tree-text">{node.text}</span>
                {node.note ? <span className="cb-tree-note">{node.note}</span> : null}
              </span>
            </span>
            {node.children?.length ? <TreeLevel nodes={node.children} order={order} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** 加工小圖元件：流程圖（flow）、雙欄對比卡（versus），卡片另有樹狀圖（tree）與表格（table）；出現時依序彈入。ADR 0025 */
export function Visual({ visual, className = '' }: VisualProps) {
  if (visual.kind === 'tree') {
    return (
      <div className={`cb-pic cb-pic-tree ${className}`.trim()}>
        {visual.legend ? (
          <span className="cb-tree-legend">
            <span className="cb-tree-legend-mark" aria-hidden="true" />
            {visual.legend}
          </span>
        ) : null}
        <TreeLevel nodes={visual.roots} order={{ n: 0 }} />
      </div>
    );
  }

  if (visual.kind === 'table') {
    return (
      <div className={`cb-pic cb-pic-table ${className}`.trim()}>
        <table className="cb-vtable">
          <thead>
            <tr>
              <th scope="col" className="cb-vtable-corner">
                {visual.corner}
              </th>
              {visual.columns.map((col, i) => (
                <th key={i} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visual.rows.map((row, r) => (
              <tr key={r} className="cb-vis-step" style={stepDelayStyle(r)}>
                <th scope="row">{row.head}</th>
                {row.cells.map((cell, c) => (
                  <td key={c}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

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
