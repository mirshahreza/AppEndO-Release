import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

const NODES = [
  { key: 'studio', label: 'Studio', sub: 'configure the system' },
  { key: 'data', label: 'Data', sub: 'model + publish APIs' },
  { key: 'workflows', label: 'Workflows', sub: 'orchestrate the work' },
  { key: 'functions', label: 'Functions', sub: 'run sandboxed code' },
  { key: 'portals', label: 'Portals', sub: 'reach everyone else' },
] as const;

const HEX_PATH = 'M18 1 L34 9.5 L34 26.5 L18 35 L2 26.5 L2 9.5 Z';
const NODE_GAP = 168;
const NODE_R = 18;
const CY = 44;

/**
 * The one signature motion moment: a schematic of how Studio's own
 * surfaces connect, drawn as the hexagon-and-circuit motif from the real
 * AppEndO mark. This is a literal pipeline (configure -> model -> orchestrate
 * -> execute -> surface), so the numbering is real sequence, not decoration.
 */
export const SiteSystemDiagram: React.FC<{ className?: string }> = ({ className }) => {
  const reduceMotion = useReducedMotion();
  const width = NODE_GAP * (NODES.length - 1) + NODE_R * 4;

  return (
    <div
      className={['site-diagram', className].filter(Boolean).join(' ')}
      role="img"
      aria-label="Studio connects Data, Workflows, Functions, and Portals on one control plane."
    >
      <svg
        viewBox={`0 0 ${width} 88`}
        className="site-diagram-svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {NODES.slice(0, -1).map((node, i) => {
          const x1 = NODE_R * 2 + i * NODE_GAP + NODE_R;
          const x2 = NODE_R * 2 + (i + 1) * NODE_GAP - NODE_R;
          return (
            <motion.line
              key={`edge-${node.key}`}
              x1={x1}
              y1={CY}
              x2={x2}
              y2={CY}
              className="site-diagram-edge"
              strokeDasharray="2 10"
              animate={reduceMotion ? undefined : { strokeDashoffset: [0, -24] }}
              transition={reduceMotion ? undefined : {
                duration: 1.4, repeat: Infinity, ease: 'linear', delay: i * 0.15,
              }}
            />
          );
        })}
        {NODES.map((node, i) => {
          const cx = NODE_R * 2 + i * NODE_GAP;
          return (
            // Motion's scale animation drives the SVG `transform` via CSS, which
            // would clobber a static translate() on the same element — so the
            // translate lives on a plain outer <g> and only the inner <motion.g>
            // animates, scaling around its own local center.
            <g key={node.key} transform={`translate(${cx - NODE_R}, ${CY - NODE_R})`}>
              <motion.g
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                style={{ transformOrigin: `${NODE_R}px ${NODE_R}px` }}
              >
                <path d={HEX_PATH} className="site-diagram-node" />
                <text x={NODE_R} y={NODE_R + 5} textAnchor="middle" className="site-diagram-node-mark">
                  {String(i + 1).padStart(2, '0')}
                </text>
              </motion.g>
            </g>
          );
        })}
      </svg>
      <ul className="site-diagram-legend">
        {NODES.map((node, i) => (
          <li key={node.key}>
            <span className="site-diagram-legend-index">{String(i + 1).padStart(2, '0')}</span>
            <strong>{node.label}</strong>
            <span>{node.sub}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
