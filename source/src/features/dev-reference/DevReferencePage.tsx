import React, { useCallback, useState } from 'react';
import { DevReferenceTopicPanels } from './DevReferenceTopicPanels';
import { DevReferenceTopicNav } from './DevReferenceTopicNav';
import { executeSandboxRun, INITIAL_RUN_RESULT, type SandboxExecuteOptions } from './devReferenceShared';
import {
  CRUD_HANDLER_SNIPPET,
  DEFAULT_SERVER_UTILITY_TOPIC,
  HANDLER_TEMPLATE,
  SCHEMA_FORMATS_DEFAULT_VALUE,
  SERVER_UTILITY_TOPICS,
  type ServerUtilityTopicId,
} from './devReferenceTopics';

export const DevReferencePage: React.FC = () => {
  const [activeTopic, setActiveTopic] = useState<ServerUtilityTopicId>(DEFAULT_SERVER_UTILITY_TOPIC);
  const [runResult, setRunResult] = useState(INITIAL_RUN_RESULT);

  const [pattern, setPattern] = useState('(\\w+)@(\\w+)');
  const [flags, setFlags] = useState('i');
  const [isGlobal, setIsGlobal] = useState(false);
  const [subjectText, setSubjectText] = useState('contact: ada@example, backup: bob@example');

  const [schemaText, setSchemaText] = useState(
    '{\n  "type": "object",\n  "required": ["email"],\n  "properties": { "email": { "type": "string", "format": "email" } }\n}',
  );
  const [valueText, setValueText] = useState('{\n  "email": "not-an-email"\n}');
  const [schemaFormatsValueText, setSchemaFormatsValueText] = useState(SCHEMA_FORMATS_DEFAULT_VALUE);

  const [reqBodyPayloadText, setReqBodyPayloadText] = useState('{\n  "name": "Ada",\n  "role": "admin"\n}');
  const [queryPage, setQueryPage] = useState('2');
  const [querySort, setQuerySort] = useState('name');

  const [requiredRole, setRequiredRole] = useState('ADMIN');
  const [ctxKey, setCtxKey] = useState('tenantId');

  const [handlerCode, setHandlerCode] = useState(HANDLER_TEMPLATE);
  const [handlerPayloadText, setHandlerPayloadText] = useState('{\n  "name": "Ada"\n}');

  const [crudCode, setCrudCode] = useState(CRUD_HANDLER_SNIPPET);
  const [crudPayloadText, setCrudPayloadText] = useState('{\n  "name": "New item",\n  "active": true\n}');
  const [crudMethod, setCrudMethod] = useState('POST');

  const activeTopicMeta = SERVER_UTILITY_TOPICS.find((topic) => topic.id === activeTopic);

  const run = useCallback(async (code: string, options: SandboxExecuteOptions = {}) => {
    setRunResult({ loading: true, error: null, data: null });
    const result = await executeSandboxRun(code, options);
    setRunResult(result);
  }, []);

  const reportError = useCallback((message: string) => {
    setRunResult({ loading: false, error: message, data: null });
  }, []);

  const runSchema = useCallback(async () => {
    let parsedSchema: unknown;
    let parsedValue: unknown;
    try {
      parsedSchema = JSON.parse(schemaText);
    } catch {
      setRunResult({ loading: false, error: 'Schema is not valid JSON.', data: null });
      return;
    }
    try {
      parsedValue = JSON.parse(valueText);
    } catch {
      setRunResult({ loading: false, error: 'Value is not valid JSON.', data: null });
      return;
    }
    await run(`res.json(util.validateSchema(${JSON.stringify(parsedSchema)}, ${JSON.stringify(parsedValue)}));`);
  }, [run, schemaText, valueText]);

  const handleSelectTopic = useCallback((topic: ServerUtilityTopicId) => {
    setActiveTopic(topic);
    setRunResult(INITIAL_RUN_RESULT);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Developer Reference</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Server Function sandbox — {SERVER_UTILITY_TOPICS.length} topics, all runnable against the real sandbox.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <DevReferenceTopicNav activeTopic={activeTopic} onSelect={handleSelectTopic} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {activeTopicMeta ? (
            <div className="shrink-0 border-b border-slate-200 px-3 py-2 sm:px-4">
              <p className="text-sm font-semibold text-slate-900">{activeTopicMeta.label}</p>
              <p className="mt-0.5 text-xs text-slate-600">{activeTopicMeta.description}</p>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DevReferenceTopicPanels
              activeTopic={activeTopic}
              runResult={runResult}
              run={run}
              reportError={reportError}
              regex={{
                pattern, setPattern, flags, setFlags, isGlobal, setIsGlobal, subjectText, setSubjectText,
              }}
              schema={{
                schemaText, setSchemaText, valueText, setValueText, onRun: runSchema,
              }}
              schemaFormats={{ valueText: schemaFormatsValueText, setValueText: setSchemaFormatsValueText }}
              reqBody={{ payloadText: reqBodyPayloadText, setPayloadText: setReqBodyPayloadText }}
              reqQuery={{ page: queryPage, setPage: setQueryPage, sort: querySort, setSort: setQuerySort }}
              roleGuard={{ requiredRole, setRequiredRole }}
              sessionCtx={{ ctxKey, setCtxKey }}
              handler={{
                code: handlerCode,
                setCode: setHandlerCode,
                payloadText: handlerPayloadText,
                setPayloadText: setHandlerPayloadText,
              }}
              crud={{
                code: crudCode,
                setCode: setCrudCode,
                payloadText: crudPayloadText,
                setPayloadText: setCrudPayloadText,
                method: crudMethod,
                setMethod: setCrudMethod,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
