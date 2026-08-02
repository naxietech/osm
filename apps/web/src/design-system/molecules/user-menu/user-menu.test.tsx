import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserMenu } from './user-menu';

describe('UserMenu', () => {
  it('shows the signed-in name and email', () => {
    render(<UserMenu name="Ayesha Khan" email="ayesha@oses.pk" onLogout={vi.fn()} />);
    expect(screen.getByText('Ayesha Khan')).toBeInTheDocument();
    expect(screen.getByText('ayesha@oses.pk')).toBeInTheDocument();
  });

  it('shows initials in the avatar, and a placeholder when there is no name', () => {
    const { rerender } = render(<UserMenu name="Ayesha Khan" onLogout={vi.fn()} />);
    expect(screen.getByText('AK')).toBeInTheDocument();

    rerender(<UserMenu onLogout={vi.fn()} />);
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('signs out', async () => {
    const onLogout = vi.fn();
    render(<UserMenu name="Ayesha Khan" onLogout={onLogout} />);
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('offers change-password only when there is a handler for it', async () => {
    const onChangePassword = vi.fn();
    const { rerender } = render(<UserMenu name="A" onLogout={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();

    rerender(<UserMenu name="A" onLogout={vi.fn()} onChangePassword={onChangePassword} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(onChangePassword).toHaveBeenCalledOnce();
  });

  it('names both actions in words, since each is only an icon', () => {
    // The icons carry no text, so these labels are the entire accessible name — and the
    // hover tooltip. They were hand-written on raw <button>s before the IconButton atom
    // existed; this pins them so adopting the atom cannot quietly drop either.
    render(<UserMenu name="A" onLogout={vi.fn()} onChangePassword={vi.fn()} />);
    for (const label of ['Change password', 'Log out']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('title', label);
    }
  });
});
