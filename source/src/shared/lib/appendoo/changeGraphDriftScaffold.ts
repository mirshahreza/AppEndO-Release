import type { ChangeGraph, ChangeNode } from '../../api/contracts/appendoo/changeGraph.types';
import { resolveEffectiveCapabilities } from './capabilityRegistryScaffold';

export type ChangeGraphDriftResult = {
  ok: boolean;
  staleNodeIds: string[];
  capabilityDriftNodeIds: string[];
  fingerprintDriftNodeIds: string[];
  failures: string[];
};

/** AE-7.6 — block execution when capability snapshot or target fingerprints drift. */
export const validateChangeGraphCapabilityDrift = (
  nodes: ChangeNode[],
  expectedSnapshotVersion: string,
  currentSnapshotVersion: string,
): string[] => {
  if (expectedSnapshotVersion === currentSnapshotVersion) {
    return [];
  }

  return nodes
    .filter((node) => node.capabilitySnapshotVersion === expectedSnapshotVersion)
    .map((node) => node.nodeId);
};

export const validateChangeGraphTargetFingerprints = (
  nodes: ChangeNode[],
  expectedFingerprints: Record<string, string>,
): string[] => (
  nodes
    .filter((node) => {
      const expected = expectedFingerprints[node.nodeId];
      if (!expected) return false;
      return node.result?.fingerprint !== expected;
    })
    .map((node) => node.nodeId)
);

export const resolveCurrentCapabilitySnapshotVersion = (): string => {
  const resolution = resolveEffectiveCapabilities({
    requestClass: 'ENGINEERING_CHANGE',
    mode: 'agent',
    enabledPackIds: [],
  });
  return resolution.snapshotVersion;
};

export const validateChangeGraphDrift = (
  graph: ChangeGraph,
  input?: {
    expectedSnapshotVersion?: string;
    expectedFingerprints?: Record<string, string>;
    currentSnapshotVersion?: string;
  },
): ChangeGraphDriftResult => {
  const failures: string[] = [];
  const expectedSnapshot = input?.expectedSnapshotVersion
    ?? graph.nodes.find((node) => node.capabilitySnapshotVersion)?.capabilitySnapshotVersion;
  const currentSnapshot = input?.currentSnapshotVersion ?? resolveCurrentCapabilitySnapshotVersion();

  const capabilityDriftNodeIds = expectedSnapshot
    ? validateChangeGraphCapabilityDrift(graph.nodes, expectedSnapshot, currentSnapshot)
    : [];

  const fingerprintDriftNodeIds = input?.expectedFingerprints
    ? validateChangeGraphTargetFingerprints(graph.nodes, input.expectedFingerprints)
    : [];

  if (capabilityDriftNodeIds.length > 0) {
    failures.push(`Capability snapshot drift detected for ${capabilityDriftNodeIds.length} node(s).`);
  }
  if (fingerprintDriftNodeIds.length > 0) {
    failures.push(`Target fingerprint drift detected for ${fingerprintDriftNodeIds.length} node(s).`);
  }

  return {
    ok: failures.length === 0,
    staleNodeIds: [...new Set([...capabilityDriftNodeIds, ...fingerprintDriftNodeIds])],
    capabilityDriftNodeIds,
    fingerprintDriftNodeIds,
    failures,
  };
};

export const annotateChangeGraphCapabilitySnapshot = (
  graph: ChangeGraph,
  snapshotVersion?: string,
): ChangeGraph => {
  const version = snapshotVersion ?? resolveCurrentCapabilitySnapshotVersion();
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      capabilitySnapshotVersion: node.capabilitySnapshotVersion ?? version,
      requiredCapabilityIds: node.requiredCapabilityIds.length > 0
        ? node.requiredCapabilityIds
        : ['capability:appendo-server-functions'],
    })),
  };
};
