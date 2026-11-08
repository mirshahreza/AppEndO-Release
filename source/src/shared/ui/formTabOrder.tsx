import React, { useLayoutEffect, useRef } from 'react';

/** Sequential Tab skips this control. Click and programmatic focus still work. */
export const FORM_ACCESSORY_TAB_INDEX = -1 as const;

export const formAccessoryTabProps = {
  tabIndex: FORM_ACCESSORY_TAB_INDEX,
} as const;

const ACCESSORY_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
  '[contenteditable="true"]',
].join(',');

/** Force every nested focusable out of sequential Tab order. */
export function skipTabStopsIn(root: ParentNode | null): void {
  if (!root) {
    return;
  }

  const nodes = root.querySelectorAll<HTMLElement>(ACCESSORY_FOCUSABLE_SELECTOR);
  for (const el of nodes) {
    if (el.tabIndex !== FORM_ACCESSORY_TAB_INDEX) {
      el.tabIndex = FORM_ACCESSORY_TAB_INDEX;
    }
  }
}

export type FormAccessorySlotProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'span' | 'div';
};

/**
 * Host for chrome grouped with a field (adornment buttons, label extras).
 * Descendants stay clickable but drop out of Tab order.
 */
export const FormAccessorySlot = React.forwardRef<HTMLElement, FormAccessorySlotProps>(
  function FormAccessorySlot({ children, className, as: Tag = 'span' }, forwardedRef) {
    const innerRef = useRef<HTMLElement | null>(null);

    const setRef = (node: HTMLElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    useLayoutEffect(() => {
      const root = innerRef.current;
      if (!root) {
        return;
      }

      skipTabStopsIn(root);
      const observer = new MutationObserver(() => skipTabStopsIn(root));
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['tabindex'],
      });
      return () => observer.disconnect();
    });

    return (
      <Tag ref={setRef as never} className={className} data-form-tab="accessory">
        {children}
      </Tag>
    );
  },
);
