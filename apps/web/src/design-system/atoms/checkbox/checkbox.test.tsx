import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('associates the label so clicking the text toggles the box', () => {
    const handleChange = vi.fn();
    render(<Checkbox label="Remember me" checked={false} onChange={handleChange} />);
    fireEvent.click(screen.getByText('Remember me'));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('reflects the checked prop', () => {
    render(<Checkbox label="Required" checked readOnly />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders a bare input when no label is given', () => {
    const { container } = render(<Checkbox checked={false} readOnly />);
    expect(container.querySelector('label')).toBeNull();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('sets the indeterminate DOM property only while unchecked', () => {
    const { rerender } = render(<Checkbox indeterminate checked={false} readOnly />);
    expect(screen.getByRole('checkbox')).toBePartiallyChecked();

    rerender(<Checkbox indeterminate checked readOnly />);
    expect(screen.getByRole('checkbox')).not.toBePartiallyChecked();
  });

  it('marks the box disabled and drops the pointer cursor on its label', () => {
    render(<Checkbox label="Locked" checked={false} disabled readOnly />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('Locked')).toHaveClass('cursor-not-allowed');
  });
});
