import React from 'react';
import { cn } from '../../lib/utils';

export type AtmosphereBackdropProps = {
  className?: string;
  /** Push decorative accents toward sidebar chrome or the header band. */
  focus?: 'default' | 'sidebar-lower' | 'header';
};

const AtmosphereBackdropShapes: React.FC = () => (
  <>
    <div className="install-wizard-backdrop__glow install-wizard-backdrop__glow--a" />
    <div className="install-wizard-backdrop__glow install-wizard-backdrop__glow--b" />
    <div className="install-wizard-backdrop__glow install-wizard-backdrop__glow--c" />
    <div className="install-wizard-backdrop__blob install-wizard-backdrop__blob--a" />
    <div className="install-wizard-backdrop__blob install-wizard-backdrop__blob--b" />
    <div className="install-wizard-backdrop__ring install-wizard-backdrop__ring--a" />
    <div className="install-wizard-backdrop__ring install-wizard-backdrop__ring--b" />
    <div className="install-wizard-backdrop__ring install-wizard-backdrop__ring--c" />
    <div className="install-wizard-backdrop__ring install-wizard-backdrop__ring--d" />
    <div className="install-wizard-backdrop__ring install-wizard-backdrop__ring--e" />
    <div className="install-wizard-backdrop__arc install-wizard-backdrop__arc--a" />
    <div className="install-wizard-backdrop__arc install-wizard-backdrop__arc--b" />
    <div className="install-wizard-backdrop__arc install-wizard-backdrop__arc--c" />
    <div className="install-wizard-backdrop__diamond install-wizard-backdrop__diamond--a" />
    <div className="install-wizard-backdrop__diamond install-wizard-backdrop__diamond--b" />
    <div className="install-wizard-backdrop__dot install-wizard-backdrop__dot--a" />
    <div className="install-wizard-backdrop__dot install-wizard-backdrop__dot--b" />
    <div className="install-wizard-backdrop__dot install-wizard-backdrop__dot--c" />
    <div className="install-wizard-backdrop__dot install-wizard-backdrop__dot--d" />
    <div className="install-wizard-backdrop__dot install-wizard-backdrop__dot--e" />
    <div className="install-wizard-backdrop__dot install-wizard-backdrop__dot--f" />
    <div className="install-wizard-backdrop__dot install-wizard-backdrop__dot--g" />
    <div className="install-wizard-backdrop__line install-wizard-backdrop__line--a" />
    <div className="install-wizard-backdrop__line install-wizard-backdrop__line--b" />
    <div className="install-wizard-backdrop__line install-wizard-backdrop__line--c" />
    <div className="install-wizard-backdrop__line install-wizard-backdrop__line--d" />
  </>
);

/** Soft geometric accents — shared by install wizard and admin shell chrome. */
export const AtmosphereBackdrop: React.FC<AtmosphereBackdropProps> = ({
  className,
  focus = 'default',
}) => (
  <div
    className={cn(
      'install-wizard-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden',
      focus === 'sidebar-lower' && 'install-wizard-backdrop--sidebar-lower',
      focus === 'header' && 'install-wizard-backdrop--header',
      className,
    )}
    aria-hidden
  >
    {focus === 'sidebar-lower' ? (
      <div className="install-wizard-backdrop__stage">
        <AtmosphereBackdropShapes />
      </div>
    ) : (
      <AtmosphereBackdropShapes />
    )}
  </div>
);
