// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  DEVELOPMENT_CATALOG_CARD_GRID_CLASS,
  DevelopmentCatalogCardFooter,
  DevelopmentCatalogCardHeader,
} from '../DevelopmentCatalogCards';
import { TYPE_CAPTION_CLASS, TYPE_IDENTIFIER_CLASS, TYPE_SECTION_TITLE_CLASS } from '../typographyRoles';

describe('DevelopmentCatalogCards', () => {
  it('uses a dense 5/6 column inventory grid', () => {
    expect(DEVELOPMENT_CATALOG_CARD_GRID_CLASS).toContain('xl:grid-cols-5');
    expect(DEVELOPMENT_CATALOG_CARD_GRID_CLASS).toContain('2xl:grid-cols-6');
    expect(DEVELOPMENT_CATALOG_CARD_GRID_CLASS).not.toContain('2xl:grid-cols-4');
  });

  it('sets identifier titles in mono and label titles in the section role', () => {
    const { rerender } = render(
      <DevelopmentCatalogCardHeader title="hwy_members" titleTone="identifier" />,
    );
    expect(screen.getByText('hwy_members').className).toContain(TYPE_IDENTIFIER_CLASS);

    rerender(<DevelopmentCatalogCardHeader title="Orders workflow" />);
    expect(screen.getByText('Orders workflow').className).toContain(TYPE_SECTION_TITLE_CLASS);
    expect(screen.getByText('Orders workflow').className).not.toContain('font-mono');
  });

  it('keeps catalog meta on the caption role without semibold', () => {
    render(<DevelopmentCatalogCardFooter date="8 columns · PK: id" />);
    const meta = screen.getByText('8 columns · PK: id');
    expect(meta.className).toContain(TYPE_CAPTION_CLASS);
    expect(meta.className).not.toContain('font-semibold');
  });
});
