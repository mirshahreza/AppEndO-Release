export { ListPageToolbarScrollHost, ListPageToolbarScrollRoot } from './ListPageToolbarScrollHost';
export {
  ListPageToolbarScrollProvider,
  useListPageToolbarScrollContext,
} from './ListPageToolbarScrollContext';
export {
  ListPageColumn,
  ListPageShell,
  ListPageToolbarFrame,
} from './ListPageShell';

/**
 * @deprecated No-op — use `ListPageToolbarScrollHost` / `ListPageToolbarScrollRoot` with `collapsed={listToolbarCollapsed}`.
 * Do not pass this into `className`; it never animated collapse.
 */
export function listPageToolbarCollapsedClass(_collapsed: boolean): string {
  return '';
}
