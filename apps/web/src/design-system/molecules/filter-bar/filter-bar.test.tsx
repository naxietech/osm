import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterBar } from './filter-bar';

const ROLE_OPTIONS = [
  { value: 'r1', label: 'Admin' },
  { value: 'r2', label: 'Evaluator' },
];

function setup(overrides: Partial<React.ComponentProps<typeof FilterBar>> = {}): {
  onSearchChange: ReturnType<typeof vi.fn>;
  onClear: ReturnType<typeof vi.fn>;
  onRoleChange: ReturnType<typeof vi.fn>;
} {
  const onSearchChange = vi.fn();
  const onClear = vi.fn();
  const onRoleChange = vi.fn();

  render(
    <FilterBar
      searchValue=""
      onSearchChange={onSearchChange}
      searchLabel="Search users"
      filters={[
        {
          id: 'role',
          label: 'Role',
          value: '',
          allLabel: 'All roles',
          options: ROLE_OPTIONS,
          onChange: onRoleChange,
        },
      ]}
      onClear={onClear}
      {...overrides}
    />,
  );

  return { onSearchChange, onClear, onRoleChange };
}

describe('FilterBar', () => {
  it('reports what was typed', async () => {
    const { onSearchChange } = setup();
    await userEvent.type(screen.getByLabelText('Search users'), 'a');
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('offers a "no filter" row above the real options', async () => {
    const { onRoleChange } = setup();

    await userEvent.click(screen.getByRole('combobox', { name: /role/i }));
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('All roles');

    await userEvent.click(screen.getByRole('option', { name: 'Evaluator' }));
    expect(onRoleChange).toHaveBeenCalledWith('r2');
  });

  it('empties the filter by choosing the "no filter" row', async () => {
    // `''` is the agreed "no filter" value all the way to the API, which omits the param
    // rather than sending an empty one the server would reject.
    const onChange = vi.fn();
    setup({
      filters: [
        {
          id: 'role',
          label: 'Role',
          value: 'r1',
          allLabel: 'All roles',
          options: ROLE_OPTIONS,
          onChange,
        },
      ],
    });

    await userEvent.click(screen.getByRole('combobox', { name: /role/i }));
    await userEvent.click(screen.getByRole('option', { name: 'All roles' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('hides Clear while nothing is narrowing the list', () => {
    setup();
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('offers Clear once a search or a filter is set', async () => {
    const { onClear } = setup({ searchValue: 'khan' });
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('treats whitespace as no search at all', () => {
    setup({ searchValue: '   ' });
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });
});
