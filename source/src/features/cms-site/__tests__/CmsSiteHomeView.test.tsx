// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CmsSiteHomeView } from '../components/CmsSiteHomeView';
import { EMPTY_CMS_PUBLIC_FIELDS } from '../../../shared/api/contracts/cms-site/types';

vi.mock('../hooks/useCmsPublicSite', () => ({
  useCmsPublicSite: () => ({
    isLoading: false,
    isError: false,
    data: {
      chrome: {
        brandName: 'Harbor',
        tagline: '',
        footerCopy: '',
        legal: '© Harbor',
        ctaLabel: 'Say hello',
        ctaSlug: 'contact',
        contactEmail: 'hello@harbor.site',
        contactPhone: '',
        nav: [{ slug: '', title: 'Home' }, { slug: 'about', title: 'About' }],
      },
      home: {
        hero: {
          id: '1',
          slug: 'home',
          title: 'A calm page with a bright pulse.',
          summary: 'Harbor is the public website.',
          body: '',
          bodyFormat: 'plain',
          contentType: 'page',
          language: 'en',
          publishedAt: null,
          authorDisplayName: 'Public site',
          coverImageUrl: null,
          imageUrls: [],
          ...EMPTY_CMS_PUBLIC_FIELDS,
        },
        about: {
          id: '2',
          slug: 'about',
          title: 'Built to be edited, not locked in core.',
          summary: 'CMS pages and fragments.',
          body: '',
          bodyFormat: 'plain',
          contentType: 'page',
          language: 'en',
          publishedAt: null,
          authorDisplayName: '',
          coverImageUrl: null,
          imageUrls: [],
          ...EMPTY_CMS_PUBLIC_FIELDS,
        },
        contact: {
          id: '3',
          slug: 'contact',
          title: 'Tell us what you are building.',
          summary: '',
          body: '',
          bodyFormat: 'plain',
          contentType: 'page',
          language: 'en',
          publishedAt: null,
          authorDisplayName: '',
          coverImageUrl: null,
          imageUrls: [],
          ...EMPTY_CMS_PUBLIC_FIELDS,
        },
        slides: [
          {
            id: '4',
            slug: 'slide-01',
            title: 'Quiet tools. Loud results.',
            summary: '01 — Studio',
            body: 'Slide copy',
            bodyFormat: 'plain',
            contentType: 'fragment',
            language: 'en',
            publishedAt: null,
            authorDisplayName: '',
            coverImageUrl: '/api/cms-site/public/assets/4',
            imageUrls: ['/api/cms-site/public/assets/4'],
            ...EMPTY_CMS_PUBLIC_FIELDS,
          },
        ],
        stories: [
          {
            id: '5',
            slug: 'welcome-to-cms',
            title: 'Welcome to CMS',
            summary: 'Published article',
            body: '',
            bodyFormat: 'plain',
            contentType: 'article',
            language: 'en',
            publishedAt: null,
            authorDisplayName: '',
            coverImageUrl: null,
            imageUrls: [],
            ...EMPTY_CMS_PUBLIC_FIELDS,
            tags: [{ slug: 'field', title: 'Field', count: 1 }],
          },
        ],
        tagCloud: [{ slug: 'field', title: 'Field', count: 1 }],
      },
      cacheTtlSeconds: 300,
    },
  }),
}));

describe('CmsSiteHomeView', () => {
  it('renders CMS-backed home sections, slides, and contact', () => {
    render(
      <MemoryRouter>
        <CmsSiteHomeView />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A calm page with a bright pulse.');
    expect(screen.getByRole('heading', { name: 'Built to be edited, not locked in core.' })).toBeInTheDocument();
    expect(document.getElementById('about')).toBeTruthy();
    expect(document.getElementById('work')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the contact page' })).toHaveAttribute('href', '/us/contact');
    expect(screen.getByLabelText('Featured slides')).toBeInTheDocument();
    expect(document.querySelector('.site-slides-viewport img')).toHaveAttribute(
      'src',
      '/api/cms-site/public/assets/4',
    );
    expect(screen.getByRole('heading', { name: 'Welcome to CMS' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Welcome to CMS' })).toHaveAttribute('href', '/us/welcome-to-cms');
    expect(screen.getByLabelText('Tag cloud')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Field' })[0]).toHaveAttribute('href', '/us?tag=field');
  });
});
