import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';

/** In-app public-site navigation — stays inside SiteLayout. */
export const SiteLink: React.FC<LinkProps> = ({ children, ...props }) => (
  <Link {...props}>{children}</Link>
);
