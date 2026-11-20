import React, { useMemo, useState } from 'react';
import type { FederatedRoundPoint } from '../types';

interface ConvergenceChartProps {
  rounds: FederatedRoundPoint[];
}

export const ConvergenceChart: React.FC<ConvergenceChartProps> = ({ rounds }) => {
  const [activeIdx, setActiveIdx] = useState<number>(Math.max(0, rounds.length - 1));

  const safeIdx = Math.min(activeIdx, Math.max(0, rounds.length - 1));
  const activePoint = rounds[safeIdx];

  const width = 640;
  const height = 270;
  const pad = { top: 24, right: 52, bottom: 38, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { accPath, areaPath, lossPath, points, maxLoss } = useMemo(() => {
    if (rounds.length === 0) {
      return { accPath: '', areaPath: '', lossPath: '', points: [], maxLoss: 1 };
    }
    const maxL = Math.max(0.8, ...rounds.map((r) => r.globalLoss * 1.15));
    const minAcc = 0.45;
    const maxAcc = 1.0;

    const pts = rounds.map((r, i) => {
      const x =
        rounds.length === 1
          ? pad.left + plotW / 2
          : pad.left + (i / (rounds.length - 1)) * plotW;
      const clampedAcc = Math.max(minAcc, Math.min(maxAcc, r.globalAccuracy));
      const yAcc = pad.top + ((maxAcc - clampedAcc) / (maxAcc - minAcc)) * plotH;
      const yLoss = pad.top + ((maxL - r.globalLoss) / maxL) * plotH;
      return { x, yAcc, yLoss, round: r, index: i };
    });

    const accD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yAcc.toFixed(1)}`).join(' ');
    const areaD =
      pts.length > 0
        ? `${accD} L ${pts[pts.length - 1].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
        : '';
    const lossD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yLoss.toFixed(1)}`).join(' ');

    return { accPath: accD, areaPath: areaD, lossPath: lossD, points: pts, maxLoss: maxL };
  }, [rounds, plotH, plotW, pad.left, pad.top]);

  const activeCoord = points[safeIdx];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 bg-blue-600 dark:bg-sky-400" aria-hidden="true" />
            <span>Global Accuracy (%)</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-600 dark:border-amber-400" aria-hidden="true" />
            <span>Cross-Entropy Loss</span>
          </span>
        </div>

        {activePoint && (
          <div
            aria-live="polite"
            className="font-mono text-xs tabular-nums text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md"
          >
            R{activePoint.roundNumber} · Acc {(activePoint.globalAccuracy * 100).toFixed(1)}% · Loss{' '}
            {activePoint.globalLoss.toFixed(3)} · ε {activePoint.epsilonBudget.toFixed(2)}
          </div>
        )}
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          role="img"
          aria-label="Dual-axis federated learning convergence chart showing global diagnostic accuracy and cross-entropy loss across rounds"
        >
          <defs>
            <linearGradient id="accAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines + Y labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.top + t * plotH;
            const accVal = Math.round((1.0 - t * 0.55) * 100);
            const lossVal = (maxLoss * (1 - t)).toFixed(2);
            return (
              <g key={t}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + plotW}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
                >
                  {accVal}%
                </text>
                <text
                  x={pad.left + plotW + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-amber-700 dark:fill-amber-400 font-mono text-[10px]"
                >
                  {lossVal}
                </text>
              </g>
            );
          })}

          {/* Crosshair vertical line */}
          {activeCoord && (
            <line
              x1={activeCoord.x}
              y1={pad.top}
              x2={activeCoord.x}
              y2={pad.top + plotH}
              className="stroke-slate-400 dark:stroke-slate-600"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Area & curves */}
          {areaPath && <path d={areaPath} fill="url(#accAreaGrad)" />}
          {lossPath && (
            <path
              d={lossPath}
              fill="none"
              className="stroke-amber-600 dark:stroke-amber-400"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          )}
          {accPath && (
            <path
              d={accPath}
              fill="none"
              className="stroke-blue-600 dark:stroke-sky-400"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive nodes + X labels */}
          {points.map((pt) => {
            const isSelected = pt.index === safeIdx;
            const showLabel =
              points.length <= 12 ||
              pt.index === 0 ||
              pt.index === points.length - 1 ||
              pt.index % 2 === 0;
            return (
              <g key={pt.round.roundNumber}>
                {showLabel && (
                  <text
                    x={pt.x}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
                  >
                    R{pt.round.roundNumber}
                  </text>
                )}
                <circle
                  cx={pt.x}
                  cy={pt.yLoss}
                  r={isSelected ? 4 : 2.5}
                  className="fill-amber-600 dark:fill-amber-400"
                />
                <circle
                  cx={pt.x}
                  cy={pt.yAcc}
                  r={isSelected ? 5 : 3}
                  className={
                    isSelected
                      ? 'fill-blue-600 dark:fill-sky-400 stroke-white dark:stroke-slate-900'
                      : 'fill-blue-600 dark:fill-sky-400'
                  }
                  strokeWidth={isSelected ? 2 : 0}
                />
                {/* Large accessible hit target */}
                <rect
                  x={pt.x - 14}
                  y={pad.top}
                  width={28}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`Round ${pt.round.roundNumber}: Accuracy ${(pt.round.globalAccuracy * 100).toFixed(1)} percent, Loss ${pt.round.globalLoss.toFixed(3)}`}
                  onMouseEnter={() => setActiveIdx(pt.index)}
                  onFocus={() => setActiveIdx(pt.index)}
                  onClick={() => setActiveIdx(pt.index)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') setActiveIdx(Math.min(points.length - 1, pt.index + 1));
                    if (e.key === 'ArrowLeft') setActiveIdx(Math.max(0, pt.index - 1));
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

interface CalibrationRadarProps {
  latest: {
    globalAccuracy: number;
    aucRoc: number;
    sensitivity: number;
    specificity: number;
    epsilonBudget: number;
    signatureValid: boolean;
  } | null;
  baseline: FederatedRoundPoint | undefined;
}

export const CalibrationRadarChart: React.FC<CalibrationRadarProps> = ({ latest, baseline }) => {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 88;

  const axes = useMemo(() => {
    if (!latest) return [];
    const privacyScore = Math.max(0.35, Math.min(1, 1 - (latest.epsilonBudget - 0.5) / 10));
    const basePrivacy = baseline ? Math.max(0.35, Math.min(1, 1 - (baseline.epsilonBudget - 0.5) / 10)) : 0.85;
    return [
      { label: 'ACC', current: latest.globalAccuracy, base: baseline?.globalAccuracy ?? 0.65 },
      { label: 'AUC', current: latest.aucRoc, base: baseline?.aucRoc ?? 0.68 },
      { label: 'SENS', current: latest.sensitivity, base: baseline?.sensitivity ?? 0.62 },
      { label: 'SPEC', current: latest.specificity, base: baseline?.specificity ?? 0.66 },
      { label: 'PRIV', current: privacyScore, base: basePrivacy },
      { label: 'INTEG', current: latest.signatureValid ? 0.99 : 0.2, base: 0.95 },
    ];
  }, [latest, baseline]);

  const toXY = (idx: number, val: number) => {
    const angle = (Math.PI * 2 * idx) / 6 - Math.PI / 2;
    const r = val * radius;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  const currentPoly = axes
    .map((a, i) => {
      const p = toXY(i, a.current);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  const basePoly = axes
    .map((a, i) => {
      const p = toXY(i, a.base);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[270px] h-auto"
        role="img"
        aria-label="Six-axis radar chart comparing latest federated round against round 1 baseline across accuracy, AUC-ROC, sensitivity, specificity, privacy, and integrity"
      >
        {[0.25, 0.5, 0.75, 1].map((ring) => {
          const pts = Array.from({ length: 6 }, (_, i) => {
            const p = toXY(i, ring);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          }).join(' ');
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
            />
          );
        })}

        {axes.map((a, i) => {
          const edge = toXY(i, 1);
          const lbl = toXY(i, 1.24);
          return (
            <g key={a.label}>
              <line
                x1={cx}
                y1={cy}
                x2={edge.x}
                y2={edge.y}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
              <text
                x={lbl.x}
                y={lbl.y + 3}
                textAnchor="middle"
                className="fill-slate-600 dark:fill-slate-400 font-mono text-[10px] font-medium"
              >
                {a.label}
              </text>
            </g>
          );
        })}

        {basePoly && (
          <polygon
            points={basePoly}
            className="fill-slate-400/10 stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        {currentPoly && (
          <polygon
            points={currentPoly}
            className="fill-blue-600/20 dark:fill-sky-400/20 stroke-blue-600 dark:stroke-sky-400"
            strokeWidth="2"
          />
        )}
      </svg>

      <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 bg-blue-600 dark:bg-sky-400 rounded-xs" aria-hidden="true" />
          <span>Active Global Model</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 border-t border-dashed border-slate-500" aria-hidden="true" />
          <span>Round 1 Baseline</span>
        </span>
      </div>
    </div>
  );
};

interface PrivacyUtilityChartProps {
  currentEpsilon: number;
  currentAccuracy: number;
}

export const PrivacyUtilityChart: React.FC<PrivacyUtilityChartProps> = ({
  currentEpsilon,
  currentAccuracy,
}) => {
  const width = 520;
  const height = 210;
  const pad = { top: 20, right: 24, bottom: 34, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const epsSamples = [0.4, 0.8, 1.2, 1.8, 2.5, 3.5, 5.0, 7.0];
  const minEps = 0.4;
  const maxEps = 7.0;

  const curvePts = epsSamples.map((eps) => {
    const x = pad.left + ((eps - minEps) / (maxEps - minEps)) * plotW;
    // Theoretical utility envelope under (eps, 1e-5)-DP
    const utility = Math.min(0.97, 0.62 + 0.34 * (1 - Math.exp(-eps * 0.72)));
    const y = pad.top + ((1.0 - utility) / 0.5) * plotH;
    return { x, y, eps, utility };
  });

  const pathD = curvePts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const clampedEps = Math.max(minEps, Math.min(maxEps, currentEpsilon));
  const clampedAcc = Math.max(0.5, Math.min(1.0, currentAccuracy));
  const curX = pad.left + ((clampedEps - minEps) / (maxEps - minEps)) * plotW;
  const curY = pad.top + ((1.0 - clampedAcc) / 0.5) * plotH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Differential privacy epsilon versus diagnostic accuracy curve. Current model operates at epsilon ${currentEpsilon.toFixed(2)} and accuracy ${(currentAccuracy * 100).toFixed(1)} percent.`}
    >
      {[0.5, 0.65, 0.8, 0.95].map((acc) => {
        const y = pad.top + ((1.0 - acc) / 0.5) * plotH;
        return (
          <g key={acc}>
            <line
              x1={pad.left}
              y1={y}
              x2={pad.left + plotW}
              y2={y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
            />
            <text
              x={pad.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
            >
              {Math.round(acc * 100)}%
            </text>
          </g>
        );
      })}

      {[0.5, 2.0, 3.5, 5.0, 7.0].map((eps) => {
        const x = pad.left + ((eps - minEps) / (maxEps - minEps)) * plotW;
        return (
          <text
            key={eps}
            x={x}
            y={height - 10}
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[10px]"
          >
            ε={eps.toFixed(1)}
          </text>
        );
      })}

      <path
        d={pathD}
        fill="none"
        className="stroke-cyan-600 dark:stroke-cyan-400"
        strokeWidth="2"
        strokeDasharray="4 3"
      />

      <line
        x1={curX}
        y1={pad.top}
        x2={curX}
        y2={pad.top + plotH}
        className="stroke-blue-600/40 dark:stroke-sky-400/40"
        strokeWidth="1"
      />

      <circle
        cx={curX}
        cy={curY}
        r={6}
        className="fill-blue-600 dark:fill-sky-400 stroke-white dark:stroke-slate-900"
        strokeWidth="2"
      />

      <text
        x={Math.min(width - 130, curX + 10)}
        y={Math.max(28, curY - 8)}
        className="fill-slate-800 dark:fill-slate-200 font-mono text-[10px] font-semibold"
      >
        Active (ε={currentEpsilon.toFixed(2)}, {(currentAccuracy * 100).toFixed(1)}%)
      </text>
    </svg>
  );
};

interface ConfusionHeatmapProps {
  matrix: { tp: number; fp: number; fn: number; tn: number };
}

export const ConfusionHeatmap: React.FC<ConfusionHeatmapProps> = ({ matrix }) => {
  const total = Math.max(1, matrix.tp + matrix.fp + matrix.fn + matrix.tn);
  const cells = [
    {
      label: 'True Positive',
      short: 'TP',
      count: matrix.tp,
      pct: (matrix.tp / total) * 100,
      tone: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200',
    },
    {
      label: 'False Positive',
      short: 'FP',
      count: matrix.fp,
      pct: (matrix.fp / total) * 100,
      tone: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200',
    },
    {
      label: 'False Negative',
      short: 'FN',
      count: matrix.fn,
      pct: (matrix.fn / total) * 100,
      tone: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200',
    },
    {
      label: 'True Negative',
      short: 'TN',
      count: matrix.tn,
      pct: (matrix.tn / total) * 100,
      tone: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/70 text-cyan-900 dark:text-cyan-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2" role="region" aria-label="Validation confusion matrix">
      {cells.map((cell) => (
        <div
          key={cell.short}
          className={`rounded-lg border p-3 flex flex-col justify-between gap-1 ${cell.tone}`}
        >
          <div className="flex items-center justify-between text-xs font-medium">
            <span>{cell.label}</span>
            <span className="font-mono opacity-80">{cell.short}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-mono font-semibold tabular-nums">{cell.count}</span>
            <span className="text-xs font-mono tabular-nums opacity-85">
              {cell.pct.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
