import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert } from './alert';

describe('Alert', () => {
  it('announces a success politely via role="status"', () => {
    render(<Alert>Saved.</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  });

  it('interrupts for a danger tone via role="alert"', () => {
    render(<Alert tone="danger">Login failed.</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Login failed.');
  });

  it('shows the icon badge for success and omits it for danger by default', () => {
    const { container, rerender } = render(<Alert>Done</Alert>);
    expect(container.querySelector('svg')).not.toBeNull();

    rerender(<Alert tone="danger">Nope</Alert>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('lets a caller drop the icon explicitly', () => {
    const { container } = render(<Alert withIcon={false}>Imported 12 rows.</Alert>);
    expect(container.querySelector('svg')).toBeNull();
  });
});
