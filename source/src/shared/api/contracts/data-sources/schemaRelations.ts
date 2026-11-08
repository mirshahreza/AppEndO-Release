export type SchemaRelationEdge = {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName?: string;
  /** Database ON DELETE action when introspection provides it. */
  onDelete?: string;
  /** Database ON UPDATE action when introspection provides it. */
  onUpdate?: string;
};

export type SchemaRelationTable = {
  name: string;
  columns: Array<{
    name: string;
    dataType: string;
    isPrimaryKey: boolean;
  }>;
};

export type SchemaRelationsSnapshot = {
  focusObject: string;
  objectType: 'TABLE' | 'VIEW';
  tables: SchemaRelationTable[];
  relations: SchemaRelationEdge[];
};
