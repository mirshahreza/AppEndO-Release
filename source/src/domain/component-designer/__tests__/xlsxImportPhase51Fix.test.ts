/**
 * Bug found (gap analysis #23 / Phase 51): Excel import needed a server-side OOXML reader
 * (AdmZip) — jsdom Buffer/AdmZip interop is unreliable, so this stays in Node environment.
 * Fixed in xlsxImport.ts.
 */
import { describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import { guessTabularColumnSchema } from '../csvExcelImport';
import { parseXlsxBufferToRows } from '../../../server/domain/component-designer/import/xlsxImport';

describe('Phase 51.2 — Excel OOXML parser (node)', () => {
  it('parses a minimal OOXML workbook with inlineStr cells into row objects + schema', () => {
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<sheetData>`
      + `<row r="1">`
      + `<c r="A1" t="inlineStr"><is><t>id</t></is></c>`
      + `<c r="B1" t="inlineStr"><is><t>name</t></is></c>`
      + `<c r="C1" t="inlineStr"><is><t>score</t></is></c>`
      + `</row>`
      + `<row r="2">`
      + `<c r="A2" t="inlineStr"><is><t>1</t></is></c>`
      + `<c r="B2" t="inlineStr"><is><t>Ada</t></is></c>`
      + `<c r="C2" t="inlineStr"><is><t>9.5</t></is></c>`
      + `</row>`
      + `<row r="3">`
      + `<c r="A3" t="inlineStr"><is><t>2</t></is></c>`
      + `<c r="B3" t="inlineStr"><is><t>Grace</t></is></c>`
      + `<c r="C3" t="inlineStr"><is><t>8</t></is></c>`
      + `</row>`
      + `</sheetData></worksheet>`;

    const zip = new AdmZip();
    zip.addFile('xl/worksheets/sheet1.xml', Buffer.from(sheetXml, 'utf8'));
    const parsed = parseXlsxBufferToRows(zip.toBuffer());
    expect(parsed).toEqual([
      { id: '1', name: 'Ada', score: '9.5' },
      { id: '2', name: 'Grace', score: '8' },
    ]);
    const schema = guessTabularColumnSchema(parsed);
    expect(schema.find((column) => column.name === 'id')?.inferredType).toBe('number');
    expect(schema.find((column) => column.name === 'name')?.inferredType).toBe('string');
    expect(schema.find((column) => column.name === 'score')?.inferredType).toBe('number');
  });
});
