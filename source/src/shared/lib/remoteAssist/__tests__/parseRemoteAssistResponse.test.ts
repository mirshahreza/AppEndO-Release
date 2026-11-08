import { describe, expect, it } from 'vitest';
import { parseRemoteAssistResponse } from '../parseRemoteAssistResponse';

describe('parseRemoteAssistResponse', () => {
  it('parses fenced JSON with commands', () => {
    expect(parseRemoteAssistResponse('```json\n{"text":"Listing files","commands":["ls -la"]}\n```')).toEqual({
      text: 'Listing files',
      commands: ['ls -la'],
    });
  });

  it('accepts a singular command field', () => {
    expect(parseRemoteAssistResponse('{"text":"Check uptime","command":"uptime"}')).toEqual({
      text: 'Check uptime',
      commands: ['uptime'],
    });
  });

  it('falls back to prose when JSON is absent', () => {
    expect(parseRemoteAssistResponse('The host is idle.')).toEqual({
      text: 'The host is idle.',
      commands: [],
    });
  });

  it('returns empty text and commands for blank input', () => {
    expect(parseRemoteAssistResponse('   ')).toEqual({
      text: '',
      commands: [],
    });
  });
});
