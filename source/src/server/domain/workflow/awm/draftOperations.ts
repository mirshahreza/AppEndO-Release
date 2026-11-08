import { z } from 'zod';
import type { WorkflowNodeDefinition, WorkflowEdgeDefinition, StartDefinition, WorkflowVariableDefinition, WorkflowPolicyDefinition, JsonSchemaRefOrInline } from './types';
import { workflowNodeDefinitionSchema, workflowEdgeDefinitionSchema, startDefinitionSchema, workflowVariableDefinitionSchema, workflowPolicyDefinitionSchema, jsonSchemaRefOrInlineSchema } from './schemas';

/**
 * Closed `WorkflowDraftOperation` V1 discriminants and payloads — sole
 * authority per 02-ARCHITECTURE-CONTRACT.md sections 11-12. Every operation
 * carries `operationSchemaVersion`, its discriminant, stable semantic keys
 * and only the typed payload owned by that discriminant.
 */
export type WorkflowDraftOperation =
  | { operationSchemaVersion: '1'; type: 'ADD_NODE'; node: WorkflowNodeDefinition }
  | { operationSchemaVersion: '1'; type: 'MODIFY_NODE'; nodeKey: string; replacement: WorkflowNodeDefinition }
  | { operationSchemaVersion: '1'; type: 'REMOVE_NODE'; nodeKey: string }
  | { operationSchemaVersion: '1'; type: 'ADD_EDGE'; edge: WorkflowEdgeDefinition }
  | { operationSchemaVersion: '1'; type: 'MODIFY_EDGE'; edgeKey: string; replacement: WorkflowEdgeDefinition }
  | { operationSchemaVersion: '1'; type: 'REMOVE_EDGE'; edgeKey: string }
  | { operationSchemaVersion: '1'; type: 'CHANGE_START'; start: StartDefinition }
  | {
      operationSchemaVersion: '1';
      type: 'CHANGE_WORKFLOW_SCHEMA';
      inputSchema: JsonSchemaRefOrInline;
      outputSchema: JsonSchemaRefOrInline;
      variables: WorkflowVariableDefinition[];
    }
  | { operationSchemaVersion: '1'; type: 'CHANGE_WORKFLOW_POLICY'; policies: WorkflowPolicyDefinition };

export const workflowDraftOperationSchema = z.discriminatedUnion('type', [
  z.strictObject({ operationSchemaVersion: z.literal('1'), type: z.literal('ADD_NODE'), node: workflowNodeDefinitionSchema }),
  z.strictObject({ operationSchemaVersion: z.literal('1'), type: z.literal('MODIFY_NODE'), nodeKey: z.string().min(1), replacement: workflowNodeDefinitionSchema }),
  z.strictObject({ operationSchemaVersion: z.literal('1'), type: z.literal('REMOVE_NODE'), nodeKey: z.string().min(1) }),
  z.strictObject({ operationSchemaVersion: z.literal('1'), type: z.literal('ADD_EDGE'), edge: workflowEdgeDefinitionSchema }),
  z.strictObject({ operationSchemaVersion: z.literal('1'), type: z.literal('MODIFY_EDGE'), edgeKey: z.string().min(1), replacement: workflowEdgeDefinitionSchema }),
  z.strictObject({ operationSchemaVersion: z.literal('1'), type: z.literal('REMOVE_EDGE'), edgeKey: z.string().min(1) }),
  z.strictObject({ operationSchemaVersion: z.literal('1'), type: z.literal('CHANGE_START'), start: startDefinitionSchema }),
  z.strictObject({
    operationSchemaVersion: z.literal('1'),
    type: z.literal('CHANGE_WORKFLOW_SCHEMA'),
    inputSchema: jsonSchemaRefOrInlineSchema,
    outputSchema: jsonSchemaRefOrInlineSchema,
    variables: z.array(workflowVariableDefinitionSchema),
  }),
  z.strictObject({ operationSchemaVersion: z.literal('1'), type: z.literal('CHANGE_WORKFLOW_POLICY'), policies: workflowPolicyDefinitionSchema }),
]);

export const workflowDraftOperationListSchema = z.array(workflowDraftOperationSchema);
