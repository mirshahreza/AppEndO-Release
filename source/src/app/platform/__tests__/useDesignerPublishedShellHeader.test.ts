import { describe, expect, it } from 'vitest';
import {
  buildDesignerPublishedShellHeaderOverride,
  resolveDesignerPublishedNestedEditorLabels,
} from '../useDesignerPublishedShellHeader';

describe('useDesignerPublishedShellHeader helpers', () => {
  it('resolves list and item labels from edit slug', () => {
    expect(resolveDesignerPublishedNestedEditorLabels('cms/contents/edit/42')).toEqual({
      listLabel: 'Contents',
      itemLabel: '42',
    });
    expect(resolveDesignerPublishedNestedEditorLabels('crm/parties/edit/7')).toEqual({
      listLabel: 'Parties',
      itemLabel: '7',
    });
    expect(resolveDesignerPublishedNestedEditorLabels('cms/contents')).toBeNull();
  });

  it('builds Edit-mode shell override without clearing group or item identity', () => {
    expect(buildDesignerPublishedShellHeaderOverride({
      listLabel: 'Contents',
    })).toEqual({
      icon: 'FileText',
      label: 'Contents',
      description: undefined,
      titleTrail: ['Contents', 'Edit'],
    });
  });
});
