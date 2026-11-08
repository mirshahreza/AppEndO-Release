// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AgentTodoListWidget } from '../AgentTodoListWidget';

describe('AgentTodoListWidget', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders todo items with status', () => {
    render(
      <AgentTodoListWidget
        todos={[
          { id: '1', title: 'Read function', status: 'completed' },
          { id: '2', title: 'Draft UI', status: 'in_progress' },
        ]}
      />,
    );

    expect(screen.getByTestId('agent-todo-list')).toBeInTheDocument();
    expect(screen.getByText('Read function')).toBeInTheDocument();
    expect(screen.getByText('Draft UI')).toBeInTheDocument();
  });
});
