import { registerActionDefinition, registerActionProvider, getActionDefinition, resolveExactProvider } from '../registry';
import type { ActionDefinition, ActionExecutor } from '../types';
import * as dataActions from './dataActions';
import * as textActions from './textActions';
import * as dateActions from './dateActions';
import * as communicationActions from './communicationActions';
import * as integrationActions from './integrationActions';
import * as internalApiActions from './internalApiActions';
import * as webActions from './webActions';
import * as aiActions from './aiActions';
import * as cryptoActions from './cryptoActions';
import * as dbActions from './dbActions';
import * as fileActions from './fileActions';
import * as documentActions from './documentActions';
import * as identityActions from './identityActions';
import * as cmsActions from './cmsActions';
import * as baseInfoActions from './baseInfoActions';
import * as scopeActions from './scopeActions';
import * as feedbackActions from './feedbackActions';
import * as jobsActions from './jobsActions';
import * as opsActions from './opsActions';
import * as extractActions from './extractActions';
import * as eventActions from './eventActions';
import * as recordActions from './recordActions';
import * as pivotAlertActions from './pivotAlertActions';

type Contribution = { definition: ActionDefinition; executor?: ActionExecutor };

/** Every AVAILABLE Action pairs with its executor; UNAVAILABLE Actions register the definition only (catalog visibility, doc 04 section 3 — unavailable Actions do not become executable because a caller requested them). */
const CORE_PACK: Contribution[] = [
  { definition: dataActions.dataJsonParseDefinition, executor: dataActions.dataJsonParseExecutor },
  { definition: dataActions.dataJsonStringifyDefinition, executor: dataActions.dataJsonStringifyExecutor },
  { definition: dataActions.dataSetDefinition, executor: dataActions.dataSetExecutor },
  { definition: dataActions.dataAggregateDefinition, executor: dataActions.dataAggregateExecutor },
  { definition: dataActions.dataValidateDefinition, executor: dataActions.dataValidateExecutor },
  { definition: dataActions.dataCsvParseDefinition, executor: dataActions.dataCsvParseExecutor },
  { definition: dataActions.dataCsvStringifyDefinition, executor: dataActions.dataCsvStringifyExecutor },
  { definition: dataActions.dataMapRecordsDefinition, executor: dataActions.dataMapRecordsExecutor },
  { definition: extractActions.dataHtmlToTextDefinition, executor: extractActions.dataHtmlToTextExecutor },
  { definition: extractActions.dataRssParseDefinition, executor: extractActions.dataRssParseExecutor },
  { definition: dbActions.dataDbQueryDefinition, executor: dbActions.dataDbQueryExecutor },
  { definition: dbActions.dataCrudGenQueryDefinition, executor: dbActions.dataCrudGenQueryExecutor },
  { definition: recordActions.dataRecordGetDefinition, executor: recordActions.dataRecordGetExecutor },
  { definition: recordActions.dataRecordCreateDefinition, executor: recordActions.dataRecordCreateExecutor },
  { definition: recordActions.dataRecordUpdateDefinition, executor: recordActions.dataRecordUpdateExecutor },
  { definition: recordActions.dataRecordDeleteDefinition, executor: recordActions.dataRecordDeleteExecutor },
  { definition: recordActions.dataRecordCreateManyDefinition, executor: recordActions.dataRecordCreateManyExecutor },
  { definition: recordActions.dataRecordUpsertDefinition, executor: recordActions.dataRecordUpsertExecutor },
  { definition: pivotAlertActions.dataPivotThresholdCheckDefinition, executor: pivotAlertActions.dataPivotThresholdCheckExecutor },
  { definition: pivotAlertActions.dataPivotSnapshotDeliveryDefinition, executor: pivotAlertActions.dataPivotSnapshotDeliveryExecutor },

  { definition: fileActions.fileReadDefinition, executor: fileActions.fileReadExecutor },
  { definition: fileActions.fileWriteDefinition, executor: fileActions.fileWriteExecutor },

  { definition: documentActions.documentPdfGenerateDefinition, executor: documentActions.documentPdfGenerateExecutor },
  { definition: documentActions.documentDocxGenerateDefinition, executor: documentActions.documentDocxGenerateExecutor },
  { definition: documentActions.documentPdfExtractTextDefinition, executor: documentActions.documentPdfExtractTextExecutor },

  { definition: cryptoActions.cryptoHashDefinition, executor: cryptoActions.cryptoHashExecutor },
  { definition: cryptoActions.cryptoHmacDefinition, executor: cryptoActions.cryptoHmacExecutor },
  { definition: cryptoActions.cryptoHmacVerifyDefinition, executor: cryptoActions.cryptoHmacVerifyExecutor },

  { definition: textActions.textTemplateDefinition, executor: textActions.textTemplateExecutor },
  { definition: textActions.textReplaceDefinition, executor: textActions.textReplaceExecutor },
  { definition: textActions.textSplitDefinition, executor: textActions.textSplitExecutor },
  { definition: textActions.textJoinDefinition, executor: textActions.textJoinExecutor },
  { definition: textActions.textRegexMatchDefinition, executor: textActions.textRegexMatchExecutor },

  { definition: dateActions.dateNowDefinition, executor: dateActions.dateNowExecutor },
  { definition: dateActions.dateAddDefinition, executor: dateActions.dateAddExecutor },
  { definition: dateActions.dateDiffDefinition, executor: dateActions.dateDiffExecutor },
  { definition: dateActions.dateFormatDefinition, executor: dateActions.dateFormatExecutor },
  { definition: dateActions.dateTimezoneConvertDefinition, executor: dateActions.dateTimezoneConvertExecutor },

  { definition: communicationActions.communicationEmailSendDefinition, executor: communicationActions.communicationEmailSendExecutor },
  { definition: communicationActions.communicationWebhookNotifyDefinition, executor: communicationActions.communicationWebhookNotifyExecutor },
  { definition: communicationActions.communicationNotificationSendDefinition, executor: communicationActions.communicationNotificationSendExecutor },

  { definition: integrationActions.integrationHttpRequestDefinition, executor: integrationActions.integrationHttpRequestExecutor },
  { definition: internalApiActions.integrationInternalApiCallDefinition, executor: internalApiActions.integrationInternalApiCallExecutor },
  { definition: eventActions.integrationEventPublishDefinition, executor: eventActions.integrationEventPublishExecutor },
  { definition: webActions.webSearchDefinition, executor: webActions.webSearchExecutor },
  { definition: webActions.webFetchUrlDefinition, executor: webActions.webFetchUrlExecutor },
  { definition: webActions.webScreenshotUrlDefinition, executor: webActions.webScreenshotUrlExecutor },

  { definition: identityActions.identityUserGetDefinition, executor: identityActions.identityUserGetExecutor },
  { definition: identityActions.identityRoleMembersDefinition, executor: identityActions.identityRoleMembersExecutor },
  { definition: identityActions.identityUserLockDefinition, executor: identityActions.identityUserLockExecutor },
  { definition: identityActions.identityUserCountDefinition, executor: identityActions.identityUserCountExecutor },

  { definition: cmsActions.cmsContentGetDefinition, executor: cmsActions.cmsContentGetExecutor },
  { definition: cmsActions.cmsContentCreateDefinition, executor: cmsActions.cmsContentCreateExecutor },
  { definition: cmsActions.cmsContentUpdateDefinition, executor: cmsActions.cmsContentUpdateExecutor },
  { definition: cmsActions.cmsRevisionCreateDefinition, executor: cmsActions.cmsRevisionCreateExecutor },
  { definition: cmsActions.cmsTagLinkDefinition, executor: cmsActions.cmsTagLinkExecutor },
  { definition: cmsActions.cmsRelationCreateDefinition, executor: cmsActions.cmsRelationCreateExecutor },
  { definition: cmsActions.cmsAssetCreateDefinition, executor: cmsActions.cmsAssetCreateExecutor },
  { definition: cmsActions.cmsSettingsGetDefinition, executor: cmsActions.cmsSettingsGetExecutor },
  { definition: cmsActions.cmsSettingsUpdateDefinition, executor: cmsActions.cmsSettingsUpdateExecutor },

  { definition: baseInfoActions.baseInfoCreateDefinition, executor: baseInfoActions.baseInfoCreateExecutor },
  { definition: baseInfoActions.baseInfoUpdateDefinition, executor: baseInfoActions.baseInfoUpdateExecutor },

  { definition: scopeActions.scopeMembershipGrantDefinition, executor: scopeActions.scopeMembershipGrantExecutor },
  { definition: scopeActions.scopeMembershipRevokeDefinition, executor: scopeActions.scopeMembershipRevokeExecutor },

  { definition: feedbackActions.feedbackGetDefinition, executor: feedbackActions.feedbackGetExecutor },
  { definition: feedbackActions.feedbackUpdateStatusDefinition, executor: feedbackActions.feedbackUpdateStatusExecutor },
  { definition: feedbackActions.feedbackPostMessageDefinition, executor: feedbackActions.feedbackPostMessageExecutor },

  { definition: jobsActions.jobsEnqueueDefinition, executor: jobsActions.jobsEnqueueExecutor },
  { definition: opsActions.opsAppLogsRecentDefinition, executor: opsActions.opsAppLogsRecentExecutor },

  { definition: aiActions.aiLlmInvokeDefinition, executor: aiActions.aiLlmInvokeExecutor },
  { definition: aiActions.aiLlmStructuredDefinition, executor: aiActions.aiLlmStructuredExecutor },
  { definition: aiActions.aiClassifyDefinition, executor: aiActions.aiClassifyExecutor },
  { definition: aiActions.aiExtractDefinition, executor: aiActions.aiExtractExecutor },
  { definition: aiActions.aiSummarizeDefinition, executor: aiActions.aiSummarizeExecutor },
  { definition: aiActions.aiEmbeddingDefinition, executor: aiActions.aiEmbeddingExecutor },
  { definition: aiActions.aiVectorUpsertDefinition, executor: aiActions.aiVectorUpsertExecutor },
  { definition: aiActions.aiVectorSearchDefinition, executor: aiActions.aiVectorSearchExecutor },
];

/**
 * Idempotent boot-time registration — safe to call multiple times (e.g. once per test file,
 * or after a pack grows while the process is still up). Registers only missing definitions /
 * providers so newly added CORE Actions become available without a full registry reset.
 */
export function registerCoreActionPack(): void {
  identityActions.registerIdentityDynamicOptionsResolvers();
  for (const { definition, executor } of CORE_PACK) {
    if (!getActionDefinition(definition.key, definition.version)) {
      registerActionDefinition(definition);
    }
    if (!(executor && definition.availability === 'AVAILABLE')) continue;
    try {
      resolveExactProvider(definition.key, definition.version, 'core', '1');
    } catch {
      registerActionProvider({
        actionKey: definition.key,
        actionVersion: definition.version,
        providerId: 'core',
        providerVersion: '1',
        contributorType: 'CORE',
        providesCapabilities: definition.requiredCapabilities,
        registryPriority: 1000,
        executor,
      });
    }
  }
}
