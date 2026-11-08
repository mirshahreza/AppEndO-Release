/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Contact } from 'lucide-react';
import { ProfileDrawerSection } from '../profileDrawerUi';

describe('ProfileDrawerSection', () => {
  afterEach(cleanup);

  it('keeps secondary details collapsed until the header is opened', () => {
    render(
      <ProfileDrawerSection icon={<Contact className="h-3.5 w-3.5" />} label="Attributes">
        <p>Username</p>
      </ProfileDrawerSection>,
    );

    const trigger = screen.getByRole('button', { name: /attributes/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Username')).not.toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Username')).toBeVisible();
  });

  it('opens personal details when defaultExpanded is set', () => {
    render(
      <ProfileDrawerSection
        icon={<Contact className="h-3.5 w-3.5" />}
        label="Personal Details"
        defaultExpanded
      >
        <p>Username</p>
      </ProfileDrawerSection>,
    );

    expect(screen.getByRole('button', { name: /personal details/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Username')).toBeVisible();
  });
});
