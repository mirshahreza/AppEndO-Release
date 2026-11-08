import { describe, expect, it } from 'vitest';
import { mapBaseInfoApiItemsToRichSelectOptions } from '../baseInfoSelectOptions';

describe('mapBaseInfoApiItemsToRichSelectOptions notes', () => {
  it('maps Base Info note onto description for status pickers', () => {
    const options = mapBaseInfoApiItemsToRichSelectOptions({
      items: [
        {
          id: '102.002',
          label: 'Statuses',
          note: null,
        },
        {
          id: '102.002.001',
          label: 'Draft',
          note: 'Work in progress. Not visible on the public site.',
          ui_color: '#94a3b8',
          ui_html: '<i data-lucide="FilePenLine"></i>',
        },
      ],
    }, { excludeRootId: '102.002' });

    expect(options).toEqual([
      {
        id: '102.002.001',
        textValue: 'Draft',
        uiColor: '#94a3b8',
        uiHtml: '<i data-lucide="FilePenLine"></i>',
        description: 'Work in progress. Not visible on the public site.',
        shortName: null,
      },
    ]);
  });
});
