import React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { Boxes, Braces, Cpu, Database, GitBranch, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

export type TechConstellationChip = {
  icon: LucideIcon;
  /** Percent-based position within the host container — snap to CircuitTraceField intersections. */
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  size?: number;
  delay?: number;
};

export type TechConstellationProps = {
  className?: string;
  /** Overrides the default software-world icon set / layout. */
  chips?: TechConstellationChip[];
  /** Fade+scale the whole field in once the surrounding UI is ready. */
  visible?: boolean;
};

/**
 * Anchors sit on CircuitTraceField nodes (viewBox 1200×800, step 120×100).
 * Percent = (gridPx / viewBox) so chips land on line intersections, not in open cells.
 */
const DEFAULT_CHIPS: TechConstellationChip[] = [
  { icon: Terminal, top: '12.5%', left: '10%', size: 42, delay: 0 },
  { icon: GitBranch, top: '12.5%', left: '90%', size: 38, delay: 0.15 },
  { icon: Braces, top: '50%', left: '20%', size: 34, delay: 0.3 },
  { icon: Boxes, top: '50%', left: '90%', size: 36, delay: 0.2 },
  { icon: Database, top: '75%', left: '10%', size: 40, delay: 0.4 },
  { icon: Cpu, top: '87.5%', left: '80%', size: 42, delay: 0.25 },
];

/**
 * Software-world iconography snapped to the circuit grid.
 * Chips pulse at rest and lift on hover; the empty field stays click-through.
 */
export const TechConstellation: React.FC<TechConstellationProps> = ({
  className,
  chips = DEFAULT_CHIPS,
  visible = true,
}) => (
  <div className={cn('tech-constellation pointer-events-none absolute inset-0', className)} aria-hidden>
    {chips.map(({ icon: Icon, size = 34, delay = 0, ...position }, index) => (
      <div
        key={index}
        className="tech-chip-anchor"
        style={{ ...position, animationDelay: `${delay}s` }}
      >
        <motion.div
          className="tech-chip"
          style={{ width: size, height: size, animationDelay: `${delay * 0.8}s` }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.55, delay: 0.12 + delay, ease: 'easeOut' }}
        >
          <Icon className="tech-chip__icon" strokeWidth={1.6} />
        </motion.div>
      </div>
    ))}
  </div>
);
