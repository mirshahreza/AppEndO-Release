import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import {
  getCachedNavigationIconPack,
  loadNavigationIconPack,
  resolveNavigationIconFromCache,
} from './navigationIconPacks';
import { parseNavigationIconRef } from './navigationIconRef';
import type { NavigationIconComponent } from './types';

type NavigationIconProps = {
  iconRef?: string | null;
  className?: string;
  fallback?: NavigationIconComponent;
};

export const NavigationIcon: React.FC<NavigationIconProps> = ({
  iconRef,
  className,
  fallback = Settings,
}) => {
  const parsed = parseNavigationIconRef(iconRef);
  const [Icon, setIcon] = useState<NavigationIconComponent | null>(() => (
    resolveNavigationIconFromCache(iconRef)
  ));

  useEffect(() => {
    if (!parsed) {
      setIcon(null);
      return;
    }

    const cachedIcon = getCachedNavigationIconPack(parsed.packId)?.map[parsed.iconName];
    if (cachedIcon) {
      setIcon(() => cachedIcon);
      return;
    }

    let cancelled = false;
    void loadNavigationIconPack(parsed.packId).then((pack) => {
      if (!cancelled) {
        setIcon(() => pack.map[parsed.iconName] ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [iconRef, parsed?.iconName, parsed?.packId]);

  const ResolvedIcon = Icon ?? fallback;
  return <ResolvedIcon className={className} />;
};
