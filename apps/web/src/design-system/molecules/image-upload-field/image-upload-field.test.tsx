import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageUploadField } from './image-upload-field';

// jsdom doesn't implement object URLs — stub them so the preview effect is safe.
beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

const file = (name = 'photo.png'): File => new File(['x'], name, { type: 'image/png' });

describe('ImageUploadField', () => {
  it('renders the label and a placeholder upload button', () => {
    render(<ImageUploadField label="Photo" value={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Photo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument();
  });

  it('calls onChange with the selected file', () => {
    const onChange = vi.fn();
    render(<ImageUploadField label="Photo" value={null} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Photo'), { target: { files: [file()] } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.any(File));
  });

  it('switches the button to "Change photo" and shows a Remove control once a file is set', () => {
    render(<ImageUploadField label="Photo" value={file()} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /change photo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('clears the selection when Remove is clicked', () => {
    const onChange = vi.fn();
    render(<ImageUploadField label="Photo" value={file()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders the required asterisk and announces an error', () => {
    render(
      <ImageUploadField label="Photo" value={null} onChange={vi.fn()} required error="Required" />,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('rejects a non-image file and does not call onChange', () => {
    const onChange = vi.fn();
    render(<ImageUploadField label="Photo" value={null} onChange={onChange} />);

    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Photo'), { target: { files: [pdf] } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/image file/i);
  });
});
