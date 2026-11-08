import { describe, expect, it } from 'vitest';
import {
  buildFunctionBaseName,
  buildFunctionMetadataFileName,
  buildFunctionSourceFileName,
  buildManagedFunctionId,
  sanitizeFunctionSegment,
} from '../../../core/functions/functionNaming';

describe('functionNaming', () => {
  it('sanitizes folder and name segments for file naming', () => {
    expect(sanitizeFunctionSegment('My Folder')).toBe('my-folder');
    expect(buildFunctionBaseName('Test', 'hello-world')).toBe('test.hello-world');
    expect(buildManagedFunctionId('Test', 'hello-world')).toBe('test.hello-world');
    expect(buildFunctionSourceFileName('Test', 'hello-world', 'ts')).toBe('test.hello-world.ts');
    expect(buildFunctionMetadataFileName('Test', 'hello-world')).toBe('test.hello-world.metadata.json');
  });
});
