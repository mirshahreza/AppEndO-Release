// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SitePage } from '../components/SitePage';
import { EMPTY_CMS_PUBLIC_FIELDS } from '../../../shared/api/contracts/cms-site/types';

vi.mock('../hooks/useCmsPublicSite', () => ({
  useCmsPublicLanguage: () => 'en',
  useCmsPublicSite: () => ({
    isLoading: false,
    isError: false,
    data: {
      chrome: { nav: [], brandName: 'Harbor' },
      home: {
        stories: [
          {
            id: '5',
            slug: 'welcome-to-cms',
            title: 'Welcome to CMS',
            summary: 'Published article',
            body: 'Full article body from CMS.',
            bodyFormat: 'plain',
            contentType: 'article',
            language: 'en',
            publishedAt: '2026-08-05T00:00:00.000Z',
            authorDisplayName: 'Ada',
            coverImageUrl: '/api/cms-site/public/assets/5',
            imageUrls: ['/api/cms-site/public/assets/5'],
            ...EMPTY_CMS_PUBLIC_FIELDS,
          },
          {
            id: '6',
            slug: 'second-note',
            title: 'Second note',
            summary: 'Another published piece',
            body: '',
            bodyFormat: 'plain',
            contentType: 'news',
            language: 'en',
            publishedAt: null,
            authorDisplayName: '',
            coverImageUrl: null,
            imageUrls: [],
            ...EMPTY_CMS_PUBLIC_FIELDS,
          },
        ],
        tagCloud: [],
      },
    },
  }),
}));

vi.mock('../../../shared/api/queries/cms-site', () => ({
  useCmsPublicContentQuery: () => ({
    isLoading: false,
    isError: false,
    data: {
      id: '5',
      slug: 'welcome-to-cms',
      title: 'Welcome to CMS',
      summary: 'Published article',
      body: 'Full article body from CMS.',
      bodyFormat: 'plain',
      contentType: 'article',
      language: 'en',
      publishedAt: '2026-08-05T00:00:00.000Z',
      authorDisplayName: 'Ada',
      coverImageUrl: '/api/cms-site/public/assets/5',
      imageUrls: ['/api/cms-site/public/assets/5'],
      ...EMPTY_CMS_PUBLIC_FIELDS,
      seoTitle: 'Welcome listing',
      seoNote: 'A published CMS article.',
      commentsEnabled: true,
      tags: [{ slug: 'field', title: 'Field', count: 1 }],
      related: [
        {
          slug: 'second-note',
          title: 'Second note',
          summary: 'Another published piece',
          contentType: 'news',
          coverImageUrl: null,
        },
      ],
      comments: [
        {
          id: '9',
          title: 'The puddle sentence',
          body: 'Thank you for the walk.',
          authorDisplayName: 'Mira Bell',
          publishedAt: '2026-08-05T12:00:00.000Z',
        },
      ],
    },
  }),
}));

describe('SitePage', () => {
  it('renders a full published story inside SiteLayout chrome', () => {
    render(
      <MemoryRouter initialEntries={['/us/welcome-to-cms']}>
        <SitePage slug="welcome-to-cms" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to CMS');
    expect(screen.getByText('Full article body from CMS.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/us');
    expect(screen.getByRole('link', { name: /Second note/ })).toHaveAttribute('href', '/us/second-note');
    expect(screen.getByText('Listed as Welcome listing')).toBeInTheDocument();
    expect(screen.getByText('A published CMS article.')).toBeInTheDocument();
    expect(screen.getByText('Thank you for the walk.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Field' })).toHaveAttribute('href', '/us?tag=field');
    expect(document.querySelector('.site-story-cover img')).toHaveAttribute(
      'src',
      '/api/cms-site/public/assets/5',
    );
    expect(screen.getByRole('button', { name: 'View larger: Welcome to CMS' })).toBeInTheDocument();
  });
});
