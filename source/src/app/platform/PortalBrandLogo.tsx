import React from 'react';
import { AppEndLogo, type AppEndLogoProps } from '../../components/AppEndLogo';
import { useResolvedPortalBrand } from './usePortalBrand';
import {
  resolveShellLogoAltText,
  resolveShellLogoHref,
  resolveShellLogoImageSrc,
  type ShellLogoConfig,
} from '../../shared/lib/shellLogoProps';

export type PortalBrandLogoProps = Omit<AppEndLogoProps, 'src' | 'alt'> & {
  layoutLogo?: ShellLogoConfig | null;
};

export const PortalBrandLogo: React.FC<PortalBrandLogoProps> = ({
  layoutLogo = null,
  href,
  ...props
}) => {
  const brand = useResolvedPortalBrand();
  const src = brand.logoUrl || resolveShellLogoImageSrc(layoutLogo);
  const alt = brand.title || resolveShellLogoAltText(layoutLogo);
  const resolvedHref = href ?? resolveShellLogoHref(layoutLogo);

  return (
    <AppEndLogo
      {...props}
      src={src}
      alt={alt}
      href={resolvedHref}
    />
  );
};
