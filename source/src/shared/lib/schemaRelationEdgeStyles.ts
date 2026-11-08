import type { EdgeModelAssociation } from '../api/contracts/data-api';

export type SchemaRelationNature = 'physical' | 'logical' | 'both';

export type SchemaRelationEdgeData = {
  /** Primary name shown on the edge (alias / constraint / column pair). */
  title: string;
  /** Relation kind line (Belongs to, Has many, column mapping, …). */
  kindLabel: string;
  /** Nature line: Physical | Logical (physical FK shows Physical even when an association also exists) */
  natureLabel: string;
  relationNature: SchemaRelationNature;
  associationId?: string;
  associationKind?: EdgeModelAssociation['kind'];
  associationAs?: string;
  fromColumn?: string;
  toColumn?: string;
  physicalConstraintName?: string;
  onDelete?: string;
  onUpdate?: string;
  /** Index among edges with the same source → target (parallel FK / association lines). */
  parallelIndex?: number;
  parallelTotal?: number;
  /** Label anchor along the source→target chord (0 = source, 1 = target; default 0.5). */
  labelAlongFraction?: number;
  /** Extra offset perpendicular to the edge (px) to reduce label collisions. */
  labelNormalOffset?: number;
  /** Focused drill-down: spread parallel edges into readable lanes. */
  drillDownRibbon?: boolean;
};

export const SCHEMA_RELATION_PHYSICAL_STYLE = {
  stroke: '#8b5cf6',
  strokeWidth: 1.6,
} as const;

export const SCHEMA_RELATION_LOGICAL_STYLE = {
  stroke: '#0d9488',
  strokeWidth: 1.6,
  strokeDasharray: '6 4',
} as const;

export const SCHEMA_RELATION_BOTH_STYLE = {
  stroke: '#6366f1',
  strokeWidth: 1.8,
  strokeDasharray: '8 3 2 3',
} as const;

export const schemaRelationEdgeStyle = (nature: SchemaRelationNature) => {
  switch (nature) {
    case 'logical':
      return { ...SCHEMA_RELATION_LOGICAL_STYLE };
    case 'both':
      return { ...SCHEMA_RELATION_BOTH_STYLE };
    case 'physical':
    default:
      return { ...SCHEMA_RELATION_PHYSICAL_STYLE };
  }
};

/** Closed arrow at the relation target (referenced / parent side). */
export const schemaRelationEdgeMarker = (nature: SchemaRelationNature) => {
  const stroke = schemaRelationEdgeStyle(nature).stroke;
  return {
    type: 'arrowclosed' as const,
    color: stroke,
    width: 14,
    height: 14,
  };
};

export const schemaRelationLabelClassName = (nature: SchemaRelationNature): string => {
  switch (nature) {
    case 'logical':
      return 'border-teal-100 bg-teal-50 text-teal-800';
    case 'both':
      return 'border-indigo-100 bg-indigo-50 text-indigo-800';
    case 'physical':
    default:
      return 'border-violet-100 bg-violet-50 text-violet-800';
  }
};
