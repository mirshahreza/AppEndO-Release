const CONTROL_PLANE_OBJECT_NAME_PATTERN = /^base_/i;

/** Physical control-plane tables/views use the `base_` prefix (see docs/standards/data-model.md). */
export const isControlPlaneSchemaObjectName = (objectName: string): boolean => (
  CONTROL_PLANE_OBJECT_NAME_PATTERN.test(objectName.trim())
);

export const CONTROL_PLANE_OBJECT_LOCK_LABEL =
  'Platform schema — original columns and relations are protected; you can extend the model';

export const CONTROL_PLANE_OBJECT_LOCK_SHORT_LABEL = 'Protected';

export const isControlPlaneObjectLocked = isControlPlaneSchemaObjectName;
