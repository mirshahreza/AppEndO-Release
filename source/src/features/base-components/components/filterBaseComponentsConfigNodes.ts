import React from 'react';

const SEARCH_PROP_KEYS = [
  'label',
  'ariaLabel',
  'aria-label',
  'title',
  'description',
  'placeholder',
  'hint',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function collectPropText(props: Record<string, unknown>): string {
  return SEARCH_PROP_KEYS
    .map((key) => props[key])
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function isFieldLeaf(props: Record<string, unknown>): boolean {
  return typeof props.label === 'string'
    || typeof props.ariaLabel === 'string'
    || typeof props['aria-label'] === 'string';
}

export function collectBaseComponentsConfigSearchText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    return node.map((child) => collectBaseComponentsConfigSearchText(child)).join(' ');
  }
  if (!React.isValidElement(node)) return '';

  const props = isRecord(node.props) ? node.props : {};
  return `${collectPropText(props)} ${collectBaseComponentsConfigSearchText(props.children as React.ReactNode)}`;
}

export function filterBaseComponentsConfigNodes(
  node: React.ReactNode,
  needle: string,
  keepAll = false,
): React.ReactNode {
  const query = needle.trim().toLowerCase();
  if (!query) return node;

  if (node == null || typeof node === 'boolean') {
    return keepAll ? node : null;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    if (keepAll || String(node).toLowerCase().includes(query)) return node;
    return null;
  }

  if (Array.isArray(node)) {
    if (keepAll) return node;
    const next = node
      .map((child) => filterBaseComponentsConfigNodes(child, query, false))
      .filter((child) => child != null && child !== false);
    return next.length > 0 ? next : null;
  }

  if (!React.isValidElement(node)) {
    return keepAll ? node : null;
  }

  const props = isRecord(node.props) ? node.props : {};
  const ownText = collectPropText(props).toLowerCase();
  const ownMatch = ownText.includes(query);

  if (keepAll || ownMatch) {
    return node;
  }

  if (node.type === React.Fragment) {
    const filtered = filterBaseComponentsConfigNodes(props.children as React.ReactNode, query, false);
    if (filtered == null) return null;
    return React.cloneElement(node, undefined, filtered);
  }

  if (isFieldLeaf(props)) {
    return collectBaseComponentsConfigSearchText(node).toLowerCase().includes(query) ? node : null;
  }

  const filteredChildren = filterBaseComponentsConfigNodes(props.children as React.ReactNode, query, false);
  if (filteredChildren == null) return null;
  return React.cloneElement(node, undefined, filteredChildren);
}
