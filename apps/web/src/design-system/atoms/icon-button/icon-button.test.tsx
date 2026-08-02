import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IconButton } from './icon-button';

const Dot = (): React.ReactElement => <svg aria-hidden data-testid="dot" />;

describe('IconButton', () => {
  it('is findable by its label, which an icon alone could never provide', () => {
    render(<IconButton icon={<Dot />} label="Reset password" />);
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
  });

  it('uses the same words for the tooltip as for the accessible name', () => {
    render(<IconButton icon={<Dot />} label="Suspend account" />);
    // One prop feeds both, so a sighted user hovering and a screen reader announcing can
    // never be told two different things.
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Suspend account');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={<Dot />} label="Reset password" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('swaps the icon for a spinner while busy, and refuses clicks', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={<Dot />} label="Suspend account" isLoading onClick={onClick} />);

    const button = screen.getByRole('button');
    expect(screen.queryByTestId('dot')).not.toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps its label while busy, so the row still says what is happening', () => {
    render(<IconButton icon={<Dot />} label="Suspend account" isLoading />);
    expect(screen.getByRole('button', { name: 'Suspend account' })).toBeInTheDocument();
  });

  it('does not submit the form it sits in unless asked', () => {
    render(<IconButton icon={<Dot />} label="Reset password" />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
