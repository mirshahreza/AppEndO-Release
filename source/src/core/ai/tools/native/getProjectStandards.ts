import { PROJECT_STANDARDS, shardForStandardId } from '../../../../config/projectStandards';
import type { NativeToolDefinition } from '../ToolRegistry';
import type { ToolExecutionContext } from '../../agent/types';
import { loadStandardsShardContent, STANDARDS_SHARD_PATHS } from './standardsShardLoader';
import {
  explainKnowledgeSelection,
  findStandards as findKnowledgeStandards,
  ingestProjectStandards,
} from '../../../../shared/lib/appendoo/engineeringKnowledgeRegistry';

export const GET_PROJECT_STANDARDS_TOOL_NAME = 'get_project_standards';

export const DEFAULT_STANDARDS_QUERY_MAX_RULES = 20;
export const DEFAULT_STANDARDS_SHARD_MAX_CHARS = 6_000;

export const getProjectStandardsTool: NativeToolDefinition = {
  name: GET_PROJECT_STANDARDS_TOOL_NAME,
  description: 'Loads AppEndO project standards — filter by query keyword or load a full topic shard markdown file. Use before UI/CRUD changes to follow repo conventions. Returns version, matching rules or shard content, and pointers to AGENTS.md / docs/standards. Example: get_project_standards({ shard: "ui-grid" }) or get_project_standards({ query: "checkbox" }).',
  group: 'standards',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional keyword to filter standards by id, title, or value.',
      },
      shard: {
        type: 'string',
        description: 'Optional topic shard key (e.g. ui-grid, data-studio) — loads docs/standards/<shard>.md.',
      },
      maxRules: {
        type: 'number',
        description: 'Query mode only — max matching rules to return (default 20).',
      },
      maxChars: {
        type: 'number',
        description: 'Shard mode only — max characters of shard content (default 6000).',
      },
    },
  },
  execute: async (args, _context: ToolExecutionContext) => {
    const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
    const shardArg = typeof args.shard === 'string' ? args.shard.trim() : '';
    const maxRules = typeof args.maxRules === 'number' && args.maxRules > 0
      ? Math.min(Math.floor(args.maxRules), 50)
      : DEFAULT_STANDARDS_QUERY_MAX_RULES;
    const maxChars = typeof args.maxChars === 'number' && args.maxChars > 0
      ? Math.min(Math.floor(args.maxChars), 20_000)
      : DEFAULT_STANDARDS_SHARD_MAX_CHARS;

    if (shardArg) {
      const shard = loadStandardsShardContent(shardArg);
      if (!shard.ok) {
        return { ok: false, summary: shard.error, error: 'shard_not_found' };
      }

      const truncated = shard.content.length > maxChars;
      const content = truncated
        ? `${shard.content.slice(0, maxChars)}\n\n… (truncated — raise maxChars or read ${shard.path})`
        : shard.content;

      return {
        ok: true,
        summary: truncated
          ? `Loaded standards shard "${shard.path}" (truncated to ${maxChars} chars).`
          : `Loaded standards shard "${shard.path}".`,
        data: {
          version: PROJECT_STANDARDS.version,
          updatedAt: PROJECT_STANDARDS.updatedAt,
          shard: shardArg,
          path: shard.path,
          content,
          truncated,
          maxChars,
          agentsMdPointer: 'See AGENTS.md hub and docs/standards/INDEX.md for topic map.',
        },
      };
    }

    const registryRecords = ingestProjectStandards(PROJECT_STANDARDS);
    const knowledgeRecords = query
      ? findKnowledgeStandards(registryRecords, { query, maxResults: maxRules })
      : [];
    const selection = query
      ? explainKnowledgeSelection(registryRecords, { query, maxResults: maxRules })
      : null;
    const standards = knowledgeRecords.map((record) => ({
      id: record.sourceId,
      title: record.title,
      value: record.statement,
      appliesTo: record.appliesTo,
      shard: shardForStandardId(record.sourceId),
    }));
    const truncated = Boolean(query && selection && selection.matchedCount > standards.length);

    const summary = query
      ? truncated
        ? `Found ${selection?.matchedCount ?? standards.length} project standard(s) matching "${query}" — returning first ${standards.length}.`
        : `Found ${standards.length} project standard(s) matching "${query}".`
      : `${PROJECT_STANDARDS.standards.length} project standards (version ${PROJECT_STANDARDS.version}). Pass query to filter; shard for full topic file; see AGENTS.md + docs/standards/INDEX.md.`;

    return {
      ok: true,
      summary,
      data: query
        ? {
          version: PROJECT_STANDARDS.version,
          updatedAt: PROJECT_STANDARDS.updatedAt,
          standards,
          matchCount: selection?.matchedCount ?? standards.length,
          truncated,
          maxRules,
          knowledgeKinds: selection?.kinds,
          agentsMdPointer: 'See AGENTS.md hub and docs/standards/INDEX.md for topic shards.',
          runtimeApi: '/api/project-standards',
          shardHint: 'Pass shard (e.g. ui-grid) to load the full markdown topic file.',
        }
        : {
          version: PROJECT_STANDARDS.version,
          updatedAt: PROJECT_STANDARDS.updatedAt,
          totalCount: PROJECT_STANDARDS.standards.length,
          agentsMdPointer: 'See AGENTS.md hub and docs/standards/INDEX.md for topic shards.',
          runtimeApi: '/api/project-standards',
          hint: 'Pass query (e.g. "grid", "dialog", "checkbox") to load matching rules only.',
          shardHint: 'Pass shard (e.g. ui-grid, data-studio) to load docs/standards/<shard>.md.',
          knownShards: Object.keys(STANDARDS_SHARD_PATHS),
        },
    };
  },
};
