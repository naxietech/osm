import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('renders children text correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked and not disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClick when disabled is true', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Click
      </Button>,
    );
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does NOT call onClick when isLoading is true', () => {
    const handleClick = vi.fn();
    render(
      <Button isLoading onClick={handleClick}>
        Click
      </Button>,
    );
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows loading spinner when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies primary variant classes by default', () => {
    render(<Button>Primary</Button>);
    expect(screen.getByText('Primary')).toHaveClass('bg-brand-gradient');
  });

  it('applies danger variant classes when variant="danger"', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByText('Delete')).toHaveClass('bg-danger');
  });

  it('forwards arbitrary native attributes (name, data-*) to the button', () => {
    render(
      <Button name="save" data-testid="save-btn">
        Save
      </Button>,
    );
    const btn = screen.getByTestId('save-btn');
    expect(btn).toHaveAttribute('name', 'save');
  });

  it('renders as submit button when type="submit"', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByText('Submit').closest('button')).toHaveAttribute('type', 'submit');
  });
});
