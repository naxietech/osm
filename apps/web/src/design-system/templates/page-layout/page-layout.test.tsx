import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageLayout } from './page-layout';

describe('PageLayout', () => {
  it('renders title in nav bar', () => {
    render(
      <PageLayout title="Schools">
        <div>content</div>
      </PageLayout>,
    );
    // Query the heading specifically — "Schools" also appears as a sidebar nav item.
    expect(screen.getByRole('heading', { name: 'Schools' })).toBeInTheDocument();
  });

  it('renders children in content area', () => {
    render(
      <PageLayout title="Schools">
        <div>page content</div>
      </PageLayout>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders actions in the actions slot', () => {
    render(
      <PageLayout title="Schools" actions={<button>Add School</button>}>
        <div>content</div>
      </PageLayout>,
    );
    expect(screen.getByText('Add School')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <PageLayout title="Schools" subtitle="Manage all schools">
        <div>content</div>
      </PageLayout>,
    );
    expect(screen.getByText('Manage all schools')).toBeInTheDocument();
  });
});
