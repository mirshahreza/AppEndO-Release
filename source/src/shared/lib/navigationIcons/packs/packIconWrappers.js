// @ts-nocheck
import React from 'react';
import { Icon } from '@iconify/react';

/** @typedef {import('../types').NavigationIconComponent} NavigationIconComponent */

/**
 * @param {NavigationIconComponent} IconComponent
 * @returns {NavigationIconComponent}
 */
export function wrapSolarIcon(IconComponent) {
  /** @type {NavigationIconComponent} */
  const Wrapped = ({ className, ...props }) => (
    React.createElement(IconComponent, {
      weight: 'BoldDuotone',
      size: '1em',
      className,
      ...props,
    })
  );

  return Wrapped;
}

/**
 * @param {string} iconName
 * @returns {NavigationIconComponent}
 */
export function createMarketeqIcon(iconName) {
  /** @type {NavigationIconComponent} */
  const Wrapped = ({ className, ...props }) => (
    React.createElement(Icon, {
      icon: `marketeq:${iconName}`,
      className,
      ...props,
    })
  );

  return Wrapped;
}
