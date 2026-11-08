import { describe, expect, it } from 'vitest';
import { formatPackageFailureToastText, readPackageFailureLines } from '../../utils';

describe('package failure toast copy', () => {
  it('keeps the API message and detail lines in order', () => {
    const err = Object.assign(new Error('Install failed due to object conflicts.'), {
      details: ['Edge API already published.', 'Navigation heading conflict.'],
    });
    expect(readPackageFailureLines(err, 'Install failed.')).toEqual([
      'Install failed due to object conflicts.',
      'Edge API already published.',
      'Navigation heading conflict.',
    ]);
  });

  it('splits nested detail lines and cause messages without dropping extras', () => {
    const err = Object.assign(new Error('Install failed.'), {
      details: ['Script db/install/schema.sql failed.\nSQL 2714 at line 12'],
      cause: new Error('There is already an object named cms_contents in the database.'),
    });
    expect(readPackageFailureLines(err, 'Install failed.')).toEqual([
      'Install failed.',
      'Script db/install/schema.sql failed.',
      'SQL 2714 at line 12',
      'There is already an object named cms_contents in the database.',
    ]);
  });

  it('caps toast details and points at the dialog for the rest', () => {
    const lines = ['Install failed.', 'a', 'b', 'c', 'd', 'e', 'f'];
    expect(formatPackageFailureToastText(lines)).toBe(
      'Install failed.\na\nb\nc\nd\n… and 2 more in the dialog.',
    );
  });
});
