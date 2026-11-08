export type NavigationGuardRequest = {
  fromPath: string;
  toPath: string;
  proceed: () => void;
};

export type NavigationGuard = {
  id: string;
  shouldBlock: (request: Pick<NavigationGuardRequest, 'fromPath' | 'toPath'>) => boolean;
  onBlock: (request: NavigationGuardRequest) => void;
};

class NavigationGuardRegistry {
  private readonly guards = new Map<string, NavigationGuard>();

  register(guard: NavigationGuard): () => void {
    this.guards.set(guard.id, guard);
    return () => {
      this.guards.delete(guard.id);
    };
  }

  runGuards(fromPath: string, toPath: string, proceed: () => void): boolean {
    for (const guard of this.guards.values()) {
      if (guard.shouldBlock({ fromPath, toPath })) {
        guard.onBlock({ fromPath, toPath, proceed });
        return true;
      }
    }

    return false;
  }
}

export const navigationGuardRegistry = new NavigationGuardRegistry();

export function normalizeNavigationPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '/';
  }

  const withoutQuery = trimmed.split('?')[0]?.split('#')[0] ?? trimmed;
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }

  return withoutQuery || '/';
}
