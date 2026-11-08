export type ServerFunctionDraftOperation = 'create' | 'update';

/** Resolve create vs update for draft_server_function — editor open id is the update signal. */
export const resolveServerFunctionDraftOperation = (input: {
  targetFunctionId: string;
  pageFunctionId?: string;
  explicitFunctionId?: string;
}): { operation: ServerFunctionDraftOperation; baseFunctionId?: string } => {
  const targetFunctionId = input.targetFunctionId.trim();
  const pageFunctionId = input.pageFunctionId?.trim();
  const explicitFunctionId = input.explicitFunctionId?.trim();

  const isEditingOpenFunction = Boolean(pageFunctionId && pageFunctionId === targetFunctionId);
  const isExplicitPatchWithoutEditor = Boolean(
    explicitFunctionId
    && explicitFunctionId === targetFunctionId
    && !pageFunctionId,
  );

  if (isEditingOpenFunction || isExplicitPatchWithoutEditor) {
    return { operation: 'update', baseFunctionId: targetFunctionId };
  }

  return { operation: 'create' };
};
