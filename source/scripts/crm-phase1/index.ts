/**
 * CRM Phase 1 seed helpers (opt-in scripts only — not platform core).
 * v2: customer = base_users + base_user_profiles + `crm_customers` extension.
 */

export const CRM_TABLE_NAMES = [
  'crm_customers',
  'crm_customer_tags',
  'crm_opportunities',
  'crm_opportunity_stage_history',
  'crm_activities',
  'crm_tickets',
  'crm_ticket_messages',
] as const;

export {
  CRM_BASE_INFO_CATEGORIES,
  CRM_BASE_INFO_ROOT_TITLE,
  crmBaseInfoUiHtml,
  type CrmBaseInfoCategorySeed,
  type CrmBaseInfoItemSeed,
} from './seed/crmBaseInfoCatalog';

export {
  CRM_BASE_INFO_ROOT_ID,
  seedCrmBaseInfo,
  unseedCrmBaseInfo,
  findCrmBaseInfoItemId,
  findCrmBaseInfoCategoryId,
  type CrmBaseInfoSeedResult,
} from './seed/seedCrmBaseInfo';

export {
  seedCrmStudioMeta,
} from './seed/seedCrmStudioMeta';
