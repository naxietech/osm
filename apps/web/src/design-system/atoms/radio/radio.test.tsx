import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Radio } from './radio';

describe('Radio', () => {
  it('associates the label so clicking the text selects the option', () => {
    const handleChange = vi.fn();
    render(<Radio name="scope" label="All institutes" checked={false} onChange={handleChange} />);
    fireEvent.click(screen.getByText('All institutes'));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('reflects the checked prop', () => {
    render(<Radio name="scope" label="Selected" checked readOnly />);
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('renders a bare input when no label is given', () => {
    const { container } = render(<Radio name="scope" checked={false} readOnly />);
    expect(container.querySelector('label')).toBeNull();
    expect(screen.getByRole('radio')).toBeInTheDocument();
  });

  it('keeps one selection per name group', () => {
    render(
      <>
        <Radio name="scope" label="All" value="all" checked readOnly />
        <Radio name="scope" label="Some" value="some" checked={false} readOnly />
      </>,
    );
    const [all, some] = screen.getAllByRole('radio');
    expect(all).toBeChecked();
    expect(some).not.toBeChecked();
  });
});
