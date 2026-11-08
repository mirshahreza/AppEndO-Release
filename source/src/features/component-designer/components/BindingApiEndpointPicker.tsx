import * as React from 'react';
import {
  AlertTriangle,
  Check,
  CornerDownLeft,
  ListTree,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { DesignerApiOperationMethod } from '../../../domain/component-designer/types';
import { useAccessibleApiRoutesQuery } from '../../../shared/api/queries/my-apis';
import type { AccessibleApiRouteItem } from '../../../shared/api/contracts/my-apis/types';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSearchBox } from '../../../shared/ui/AppSearchBox';
import { UiInput, UiSelect } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import {
  API_ENDPOINT_METHODS,
  filterAccessibleApiRoutes,
  findAccessibleApiRouteMatch,
  groupAccessibleApiRoutes,
  normalizeApiEndpointMethod,
  normalizeApiEndpointPath,
} from '../lib/bindingApiEndpointSearch';
import { NESTED_LAYER_DIVIDER_CLASS } from '../../../shared/ui/surfaceClasses';

export { API_ENDPOINT_METHODS };

const INLINE_SUGGESTION_LIMIT = 8;

const METHOD_BADGE_CLASS: Record<string, string> = {
  GET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
};

const MethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const normalized = method.toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex min-w-[3.1rem] shrink-0 items-center justify-center rounded border px-1 py-0.5 font-mono text-[10px] font-bold',
        METHOD_BADGE_CLASS[normalized] ?? 'border-slate-200 bg-slate-50 text-slate-700',
      )}
    >
      {normalized}
    </span>
  );
};

type ApiRouteListProps = {
  routes: AccessibleApiRouteItem[];
  value: string;
  method: DesignerApiOperationMethod;
  onSelect: (route: AccessibleApiRouteItem) => void;
  grouped?: boolean;
  activeIndex?: number;
  indexOffset?: number;
};

const ApiRouteList: React.FC<ApiRouteListProps> = ({
  routes,
  value,
  method,
  onSelect,
  grouped = true,
  activeIndex = -1,
  indexOffset = 0,
}) => {
  const groups = grouped ? groupAccessibleApiRoutes(routes) : [['', routes] as [string, AccessibleApiRouteItem[]]];
  let runningIndex = indexOffset;

  return (
    <div className="py-1">
      {groups.map(([folder, folderRoutes]) => (
        <div key={folder || 'routes'} className="mb-1 last:mb-0">
          {grouped && folder ? (
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              {folder}
            </div>
          ) : null}
          {folderRoutes.map((route) => {
            const itemIndex = runningIndex;
            runningIndex += 1;
            const isActive = normalizeApiEndpointPath(route.path) === normalizeApiEndpointPath(value)
              && normalizeApiEndpointMethod(route.method) === method;
            const isHighlighted = activeIndex === itemIndex;
            return (
              <button
                key={`${route.id}:${route.method}:${route.path}`}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors',
                  isActive || isHighlighted ? 'bg-indigo-50/80' : 'hover:bg-slate-50',
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(route)}
              >
                <MethodBadge method={route.method} />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-700">
                  {route.path}
                </span>
                <span className="max-w-[40%] shrink-0 truncate text-[11px] text-slate-500">
                  {route.name}
                </span>
                {isActive ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-indigo-500" strokeWidth={2.5} />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export type BindingApiEndpointPickerProps = {
  value: string;
  method: DesignerApiOperationMethod;
  onChange: (endpoint: string) => void;
  onMethodChange: (method: DesignerApiOperationMethod) => void;
  /** Restrict the route list to specific HTTP methods (e.g. grids list with GET). */
  methodFilter?: readonly DesignerApiOperationMethod[];
  autoFocus?: boolean;
};

export const BindingApiEndpointPicker: React.FC<BindingApiEndpointPickerProps> = ({
  value,
  method,
  onChange,
  onMethodChange,
  methodFilter,
  autoFocus,
}) => {
  const routesQuery = useAccessibleApiRoutesQuery();
  const [browseOpen, setBrowseOpen] = React.useState(false);
  const [browseSearch, setBrowseSearch] = React.useState('');
  const [inputFocused, setInputFocused] = React.useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState(-1);

  const trimmedValue = value.trim();
  const searchTerm = trimmedValue;

  const routes = React.useMemo(
    () => filterAccessibleApiRoutes(routesQuery.data ?? [], '', methodFilter),
    [methodFilter, routesQuery.data],
  );

  const matchedRoute = React.useMemo(
    () => findAccessibleApiRouteMatch(routes, value, method),
    [method, routes, value],
  );

  const inlineMatches = React.useMemo(() => (
    searchTerm.length > 0
      ? filterAccessibleApiRoutes(routes, searchTerm, methodFilter)
      : routes
  ), [searchTerm, methodFilter, routes]);

  const inlineSuggestions = React.useMemo(
    () => inlineMatches.slice(0, INLINE_SUGGESTION_LIMIT),
    [inlineMatches],
  );

  const browseMatches = React.useMemo(
    () => filterAccessibleApiRoutes(routes, browseSearch, methodFilter),
    [browseSearch, methodFilter, routes],
  );

  const showInlineSuggestions = !browseOpen && inputFocused;

  const showCustomPathOption = trimmedValue.length > 0 && !matchedRoute;

  const suggestionCount = (showCustomPathOption ? 1 : 0) + (
    searchTerm.length > 0 || inlineSuggestions.length > 0 ? inlineSuggestions.length : 0
  );

  const closeInlineSuggestions = React.useCallback(() => {
    setInputFocused(false);
    setActiveSuggestionIndex(-1);
  }, []);

  const handleSelectRoute = React.useCallback((route: AccessibleApiRouteItem) => {
    onChange(route.path);
    onMethodChange(normalizeApiEndpointMethod(route.method));
    setBrowseSearch('');
    setBrowseOpen(false);
    closeInlineSuggestions();
  }, [closeInlineSuggestions, onChange, onMethodChange]);

  const handleUseTypedPath = React.useCallback(() => {
    closeInlineSuggestions();
  }, [closeInlineSuggestions]);

  const openBrowsePanel = React.useCallback(() => {
    setBrowseSearch(trimmedValue);
    setBrowseOpen(true);
    closeInlineSuggestions();
  }, [closeInlineSuggestions, trimmedValue]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showInlineSuggestions || suggestionCount === 0) {
      if (event.key === 'ArrowDown' && trimmedValue.length > 0) {
        setInputFocused(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current + 1) % suggestionCount);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (
        current <= 0 ? suggestionCount - 1 : current - 1
      ));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeInlineSuggestions();
      return;
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      if (showCustomPathOption && activeSuggestionIndex === 0) {
        handleUseTypedPath();
        return;
      }
      const routeIndex = showCustomPathOption
        ? activeSuggestionIndex - 1
        : activeSuggestionIndex;
      const route = inlineSuggestions[routeIndex];
      if (route) {
        handleSelectRoute(route);
      }
    }
  };

  React.useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [searchTerm, showInlineSuggestions]);

  const renderInlineSuggestions = () => {
    if (!showInlineSuggestions) {
      return null;
    }

    return (
      <div className="overflow-hidden rounded-lg border border-indigo-200 bg-white shadow-sm">
        <div className="border-b border-indigo-100 bg-indigo-50/70 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-700">
          {searchTerm.length > 0 ? 'Matching APIs' : 'Your APIs — pick one or keep typing'}
        </div>

        {routesQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Loading your APIs…
          </div>
        ) : routesQuery.isError ? (
          <div className="flex flex-col items-center gap-2 px-3 py-4 text-center text-xs text-rose-600">
            <span>Could not load API routes.</span>
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              className="h-7 px-2"
              onClick={() => { void routesQuery.refetch(); }}
            >
              <RefreshCw className="mr-1 h-3 w-3" strokeWidth={2} />
              Retry
            </AppButton>
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            {showCustomPathOption ? (
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 border-b border-slate-100 px-2.5 py-2 text-left transition-colors',
                  activeSuggestionIndex === 0 ? 'bg-indigo-50/80' : 'hover:bg-slate-50',
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleUseTypedPath}
              >
                <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-indigo-500" strokeWidth={2.2} />
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700">
                  Use typed path
                  {' '}
                  <span className="font-mono font-semibold text-indigo-700">
                    {method} {trimmedValue}
                  </span>
                </span>
              </button>
            ) : null}

            {inlineSuggestions.length > 0 ? (
              <ApiRouteList
                routes={inlineSuggestions}
                value={value}
                method={method}
                onSelect={handleSelectRoute}
                grouped={searchTerm.length === 0}
                activeIndex={activeSuggestionIndex}
                indexOffset={showCustomPathOption ? 1 : 0}
              />
            ) : searchTerm.length > 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">
                No matching APIs — use the typed path above or keep editing the path.
              </div>
            ) : (
              <div className="px-3 py-3 text-xs text-slate-500">
                No accessible API routes yet. Create one under Server Functions, then return here.
              </div>
            )}

            {searchTerm.length > 0 && inlineMatches.length > INLINE_SUGGESTION_LIMIT ? (
              <button
                type="button"
                className="w-full border-t border-slate-100 px-2.5 py-2 text-left text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50/60"
                onMouseDown={(event) => event.preventDefault()}
                onClick={openBrowsePanel}
              >
                Browse all {inlineMatches.length} matches…
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-[88px] shrink-0">
          <UiSelect
            size="sm"
            ariaLabel="HTTP method"
            value={method}
            onChange={(event) => onMethodChange(normalizeApiEndpointMethod(event.target.value))}
          >
            {API_ENDPOINT_METHODS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </UiSelect>
        </div>

        <div className="min-w-0 flex-1">
          <UiInput
            size="sm"
            className="min-w-0 w-full"
            placeholder="/api/users"
            ariaLabel="API path"
            aria-expanded={showInlineSuggestions}
            aria-autocomplete="list"
            autoFocus={autoFocus}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => {
              window.setTimeout(() => {
                setInputFocused(false);
                setActiveSuggestionIndex(-1);
              }, 150);
            }}
            onKeyDown={handleInputKeyDown}
          />
        </div>

        <AppButton
          type="button"
          intent={browseOpen ? 'primary' : 'secondary'}
          size="sm"
          className="h-8 shrink-0 px-2.5"
          aria-expanded={browseOpen}
          onClick={() => {
            if (browseOpen) {
              setBrowseOpen(false);
              return;
            }
            openBrowsePanel();
          }}
        >
          <ListTree className="mr-1 h-3.5 w-3.5" strokeWidth={2} />
          Browse
        </AppButton>
      </div>

      {renderInlineSuggestions()}

      {trimmedValue && !browseOpen && !showInlineSuggestions ? (
        matchedRoute ? (
          <p className="flex items-center gap-1 ps-[4px] text-[11px] text-emerald-600">
            <Check className="h-3 w-3" strokeWidth={2.5} />
            Matches <span className="font-semibold">{matchedRoute.name}</span>
            <span className="text-emerald-500/80">({matchedRoute.folder})</span>
          </p>
        ) : (
          <p className="flex items-center gap-1 ps-[4px] text-[11px] text-amber-600">
            <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
            Custom path — pick a suggestion below or continue with this path.
          </p>
        )
      ) : null}

      {browseOpen ? (
        <div className={`overflow-hidden rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-white shadow-sm`}>
          <div className="border-b border-slate-100 px-1.5 py-1">
            <AppSearchBox
              value={browseSearch}
              onChange={setBrowseSearch}
              placeholder="path, name, or method…"
              ariaLabel="Filter API routes"
              className="!h-8 !border-0 !shadow-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {routesQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Loading your APIs…
              </div>
            ) : routesQuery.isError ? (
              <div className="flex flex-col items-center gap-2 px-3 py-5 text-center text-xs text-rose-600">
                <span>Could not load API routes.</span>
                <AppButton
                  type="button"
                  intent="secondary"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => { void routesQuery.refetch(); }}
                >
                  <RefreshCw className="mr-1 h-3 w-3" strokeWidth={2} />
                  Retry
                </AppButton>
              </div>
            ) : routes.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-500">
                No accessible API routes yet. Create one under{' '}
                <span className="font-semibold text-slate-700">Server Functions</span>, then return here.
              </div>
            ) : browseMatches.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-500">
                No APIs match “{browseSearch.trim()}”.
              </div>
            ) : (
              <ApiRouteList
                routes={browseMatches}
                value={value}
                method={method}
                onSelect={handleSelectRoute}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
