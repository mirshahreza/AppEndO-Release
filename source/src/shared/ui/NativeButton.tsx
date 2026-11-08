import * as React from 'react';

export type NativeButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const NativeButton = React.forwardRef<HTMLButtonElement, NativeButtonProps>(function NativeButton(
  { type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} {...props} />;
});
