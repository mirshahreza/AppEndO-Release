import React from 'react';
import { cn } from '../../lib/utils';
import { getDirectionalTextProps } from '../lib/textDirection';

type DirectionalTextElement = 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'div';

export type DirectionalTextProps = {
  text: string;
  className?: string;
  as?: DirectionalTextElement;
};

/** Block/inline user-authored copy with automatic RTL alignment inside LTR shells. */
export const DirectionalText: React.FC<DirectionalTextProps> = ({
  text,
  className,
  as: Component = 'p',
}) => {
  const directional = getDirectionalTextProps(text);

  return (
    <Component className={cn(directional.className, className)} dir={directional.dir}>
      {text}
    </Component>
  );
};
