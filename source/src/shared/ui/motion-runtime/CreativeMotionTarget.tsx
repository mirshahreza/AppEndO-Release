import * as React from 'react';
import { useCreativeMotion } from './runtime';
import type { CreativeMotionTargetProps } from './types';

export function CreativeMotionTarget({
  as = 'div',
  config,
  children,
  className,
  style,
  onDecision,
}: CreativeMotionTargetProps) {
  const motion = useCreativeMotion(config, onDecision);
  return React.createElement(
    as,
    {
      ref: motion.ref,
      className,
      style,
      'data-creative-motion-target': '',
    },
    children,
  );
}
