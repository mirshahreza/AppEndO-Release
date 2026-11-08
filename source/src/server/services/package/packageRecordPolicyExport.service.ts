import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import {
  listRecordPoliciesForModel,
  getRecordPolicyById,
} from '../record-policy/recordPolicyStore';
import { getRecordPolicyBinding } from '../record-policy/recordPolicyBindingStore';

export type PackageRecordPolicyExportZipEntry = {
  path: string;
  content: Buffer;
};

export type PackageRecordPolicyExportResult = {
  capabilities: {
    scope_dimensions: NonNullable<PackageManifest['capabilities']['scope_dimensions']>;
    record_policies: NonNullable<PackageManifest['capabilities']['record_policies']>;
    record_policy_bindings: NonNullable<PackageManifest['capabilities']['record_policy_bindings']>;
  };
  zipEntries: PackageRecordPolicyExportZipEntry[];
};

const jsonEntry = (entryPath: string, payload: unknown): PackageRecordPolicyExportZipEntry => ({
  path: entryPath,
  content: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
});

/**
 * Package Record Policy authoring artifacts for selected edge models.
 * Built-in dimensions (org/geo) are platform-native — not packaged.
 * Memberships are environment data and are never exported (D9).
 */
export function buildPackageRecordPolicyExportEntries(input: {
  edgeModelIds: string[];
}): PackageRecordPolicyExportResult {
  const edgeModelIds = [...new Set(input.edgeModelIds.map((id) => id.trim()).filter(Boolean))];

  const scope_dimensions: NonNullable<PackageManifest['capabilities']['scope_dimensions']> = [];
  const record_policies: NonNullable<PackageManifest['capabilities']['record_policies']> = [];
  const record_policy_bindings: NonNullable<PackageManifest['capabilities']['record_policy_bindings']> = [];
  const zipEntries: PackageRecordPolicyExportZipEntry[] = [];

  for (const edgeModelId of edgeModelIds) {
    const binding = getRecordPolicyBinding(edgeModelId);
    if (binding && (binding.recordScope !== 'off' || binding.bindings.length > 0 || binding.forceScopeForAdmin)) {
      const entry = `record-policy/bindings/${edgeModelId}.json`;
      record_policy_bindings.push({ edgeModelId, entry });
      zipEntries.push(jsonEntry(entry, binding));
    }

    for (const policy of listRecordPoliciesForModel(edgeModelId)) {
      const full = getRecordPolicyById(policy.id) ?? policy;
      const entry = `record-policy/policies/${full.id}.json`;
      record_policies.push({ id: full.id, edgeModelId: full.edgeModelId, entry });
      zipEntries.push(jsonEntry(entry, full));
    }
  }

  return {
    capabilities: { scope_dimensions, record_policies, record_policy_bindings },
    zipEntries,
  };
}
