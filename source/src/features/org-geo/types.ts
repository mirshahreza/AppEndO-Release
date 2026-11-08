/** Chart node for organization / geography canvases (extends viz tree with active flag). */
export type OrgChartTreeNode = {
  id: string;
  label: string;
  icon?: string;
  /** Optional node `ui_color` hex — when set, overrides level color (same cascade as icon). */
  color?: string;
  isActive?: boolean;
  /** True when the node has children, even if they are not loaded yet. */
  hasChildren?: boolean;
  /** Geographic / domain type shown on the card (overrides depth level title when set). */
  typeLabel?: string;
  children?: OrgChartTreeNode[];
};
