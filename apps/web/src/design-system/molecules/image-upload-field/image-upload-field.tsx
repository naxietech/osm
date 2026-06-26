import {
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { Button } from '@/design-system/atoms/button';
import { Upload, User, X } from '@/design-system/atoms/icon';
import { cn } from '@/lib/utils';

export interface ImageUploadFieldProps {
  /** Label shown above the control. */
  label: string;
  /** The freshly-picked file (controlled); null when nothing is selected. */
  value: File | null;
  /** Called with the picked File, or null when the selection is cleared. */
  onChange: (file: File | null) => void;
  /** Existing image URL to preview in edit mode (shown until a new file is picked). */
  initialPreviewUrl?: string;
  /** Error message from the form; merged with the field's own validation errors. */
  error?: string;
  required?: boolean;
  /** Accepted file types (passed to the underlying file input). Defaults to images. */
  accept?: string;
  /** Maximum file size in MB before the field rejects the file. */
  maxSizeMb?: number;
  /** Extra classes for the outer wrapper. */
  containerClassName?: string;
}

/**
 * Premium photo uploader — a drag-and-drop zone with a passport-style portrait
 * preview, hover-to-change overlay, and inline Upload / Remove actions. Validates
 * the file type and size and surfaces its own error (merged with the form error).
 *
 * The object URL created for a File preview is revoked on change / unmount so we
 * never leak blob URLs. Mirrors FormField / SelectField: top label, `required`
 * asterisk, and a reserved error line (so showing / clearing an error never
 * shifts layout). Actual upload + storage is the consumer's job — this only
 * collects the File.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  initialPreviewUrl,
  error,
  required = false,
  accept = 'image/*',
  maxSizeMb = 2,
  containerClassName,
}: ImageUploadFieldProps): ReactElement {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Build (and clean up) the object URL used to preview the selected File.
  useEffect(() => {
    if (!value) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const preview = filePreview ?? initialPreviewUrl ?? null;
  const shownError = error ?? localError ?? undefined;
  const hasError = Boolean(shownError);

  const acceptFile = (file: File | null): void => {
    if (!file) {
      onChange(null);
      setLocalError(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setLocalError('Please choose an image file (PNG or JPG).');
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setLocalError(`Image must be under ${maxSizeMb}MB.`);
      return;
    }
    setLocalError(null);
    onChange(file);
  };

  const openPicker = (): void => inputRef.current?.click();

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    acceptFile(event.target.files?.[0] ?? null);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragActive(false);
    acceptFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleRemove = (): void => {
    onChange(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn('w-full', containerClassName)}>
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </span>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex items-center gap-5 rounded-xl border-2 border-dashed p-4 transition-all',
          dragActive
            ? 'border-brand bg-brand-subtle'
            : hasError
              ? 'border-danger bg-danger-subtle'
              : 'border-border bg-muted/30 hover:border-brand/60 hover:bg-muted/50',
        )}
      >
        {/* Portrait preview / placeholder — click to change */}
        <button
          type="button"
          onClick={openPicker}
          aria-label={preview ? 'Change photo' : 'Upload photo'}
          className={cn(
            'group relative h-32 w-24 shrink-0 overflow-hidden rounded-lg border bg-card shadow-sm transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            hasError ? 'border-danger' : 'border-border',
          )}
        >
          {preview ? (
            <>
              <img
                src={preview}
                alt="Student photo preview"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                Change
              </span>
            </>
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted/50 text-muted-foreground transition-colors group-hover:text-brand">
              <User className="h-8 w-8" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Photo</span>
            </span>
          )}
        </button>

        {/* Copy + actions */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {preview ? 'Photo ready' : 'Upload student photo'}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag &amp; drop or click to browse — PNG or JPG, up to {maxSizeMb}MB.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={openPicker}>
              <Upload className="h-4 w-4" aria-hidden />
              {preview ? 'Change' : 'Upload'}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
                <X className="h-4 w-4" aria-hidden />
                Remove
              </Button>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          aria-label={label}
          aria-describedby={hasError ? errorId : undefined}
          onChange={handleInputChange}
          className="sr-only"
        />
      </div>

      {/* Always rendered so the reserved line height keeps the field's size stable. */}
      <p
        id={errorId}
        role={hasError ? 'alert' : undefined}
        className="mt-1 min-h-4 text-xs text-danger-foreground"
      >
        {shownError}
      </p>
    </div>
  );
}

export default ImageUploadField;
