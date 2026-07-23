import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  type Annotation,
  type AnnotationColor,
  type MarkingBand,
  type MarkingBandOption,
  type MarkingScript,
  type SubmitMarkDto,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Flag } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { Kbd } from '@/design-system/atoms/kbd';
import { ProgressBar } from '@/design-system/atoms/progress-bar';
import { Textarea } from '@/design-system/atoms/textarea';
import {
  AnnotationCanvas,
  type AnnotationCanvasTool,
} from '@/design-system/molecules/annotation-canvas';
import { AnnotationToolbar } from '@/design-system/molecules/annotation-toolbar';
import {
  BAND_LABEL,
  BAND_ORDER,
  MarkingBandSelector,
  marksForBand,
} from '@/design-system/molecules/marking-band-selector';
import { cn } from '@/lib/utils';

export interface MarkingWorkspaceProps {
  /** The script in front of the checker. */
  script: MarkingScript;
  /** What each band awards on this batch. */
  rubric: MarkingBandOption[];
  subject: string;
  /** e.g. "Q4". */
  questionLabel: string;
  /** Position of this script within the batch, 1-based. */
  position: number;
  total: number;
  /** How many of the batch are already marked, for the progress bar. */
  markedCount: number;
  /** The cropped answer image. */
  imageUrl: string;
  onSubmit: (input: SubmitMarkDto) => void;
  onFlag: (reason: string) => void;
  onSkip?: () => void;
  onPrevious?: () => void;
  /** Asks the host for note text — a page supplies this (a prompt, a dialog). */
  onRequestNoteText?: () => string | null;
  className?: string;
}

/**
 * The marking workspace — the answer on the left, the rubric and controls on the right.
 *
 * Presentational: it holds only the in-progress marking state (band, comment, drawings)
 * and hands a finished mark back through `onSubmit`. It never awards marks itself — the
 * caller looks the band up in the rubric — so the four-band scale cannot be bypassed here.
 *
 * The candidate is never identified. The image is one cropped answer, and the only label
 * shown is the anonymous script reference.
 */
export function MarkingWorkspace({
  script,
  rubric,
  subject,
  questionLabel,
  position,
  total,
  markedCount,
  imageUrl,
  onSubmit,
  onFlag,
  onSkip,
  onPrevious,
  onRequestNoteText,
  className,
}: MarkingWorkspaceProps): React.ReactElement {
  const [band, setBand] = useState<MarkingBand | undefined>(script.band);
  const [comment, setComment] = useState(script.comment ?? '');
  const [annotations, setAnnotations] = useState<Annotation[]>(script.annotations ?? []);
  const [tool, setTool] = useState<AnnotationCanvasTool>('pen');
  const [color, setColor] = useState<AnnotationColor>('danger');
  const [flagging, setFlagging] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  // Moving to the next script must not carry the previous one's marking across. Keyed on
  // the script id rather than on the object, so a re-render alone does not wipe work.
  useEffect(() => {
    setBand(script.band);
    setComment(script.comment ?? '');
    setAnnotations(script.annotations ?? []);
    setFlagging(false);
    setFlagReason('');
  }, [script.id, script.band, script.comment, script.annotations]);

  const maxMarks = useMemo(
    () => rubric.reduce((max, option) => Math.max(max, option.marks), 0),
    [rubric],
  );

  const notes = annotations.filter((a) => a.tool === 'note');

  const submit = (): void => {
    if (!band) return;
    onSubmit({
      band,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      ...(annotations.length > 0 ? { annotations } : {}),
    });
  };

  // Keyboard-first marking. Held in a ref so the listener always sees current state
  // without being torn down and rebuilt on every keystroke.
  const handlers = useRef({ submit, setBand, onSkip, onPrevious, setFlagging });
  handlers.current = { submit, setBand, onSkip, onPrevious, setFlagging };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // Never steal a key while the checker is typing a comment or a flag reason.
      const target = event.target instanceof HTMLElement ? event.target : null;
      const tag = target?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // "1".."4" pick a band. A non-digit key parses to NaN and falls through.
      const index = Number.parseInt(event.key, 10) - 1;
      const chosenBand = index >= 0 ? BAND_ORDER[index] : undefined;
      if (chosenBand) {
        event.preventDefault();
        handlers.current.setBand(chosenBand);
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'enter':
          event.preventDefault();
          handlers.current.submit();
          break;
        case 'f':
          event.preventDefault();
          handlers.current.setFlagging(true);
          break;
        case 'arrowleft':
          handlers.current.onPrevious?.();
          break;
        case 'arrowright':
          handlers.current.onSkip?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-12', className)}>
      {/* Answer + drawing tools */}
      <div className="lg:col-span-8">
        <AnnotationToolbar
          className="mb-3"
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          onUndo={() => setAnnotations((current) => current.slice(0, -1))}
          onClear={() => setAnnotations([])}
          hasAnnotations={annotations.length > 0}
        />

        <AnnotationCanvas
          imageUrl={imageUrl}
          imageAlt={`Answer to ${questionLabel}, script ${script.candidateRefId}`}
          annotations={annotations}
          onChange={setAnnotations}
          tool={tool}
          color={color}
          {...(onRequestNoteText ? { onRequestNoteText } : {})}
        />

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Identity is stripped from this image.
          {/* Shortcuts are hidden on small screens — there is no keyboard to press. */}
          <span className="hidden sm:inline">
            {' '}
            Press <Kbd>1</Kbd>–<Kbd>4</Kbd> to grade, <Kbd>Enter</Kbd> to submit, <Kbd>F</Kbd> to
            flag.
          </span>
        </p>
      </div>

      {/* Rubric + comment */}
      <aside className="space-y-4 lg:col-span-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Grade this answer</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subject} · {questionLabel} · max {maxMarks} marks
          </p>

          <MarkingBandSelector className="mt-4" rubric={rubric} value={band} onChange={setBand} />

          <label htmlFor="marking-comment" className="mt-4 block text-xs text-muted-foreground">
            Comment (optional) — seen by your supervisor
          </label>
          <Textarea
            id="marking-comment"
            className="mt-1"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>

        {/* The drawing layer is invisible to a screen reader, so pinned notes are
            listed here as text. Without this they would be unreadable. */}
        {notes.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Pinned notes</h2>
            <ul className="mt-2 space-y-1.5">
              {notes.map((note) => (
                <li key={note.id} className="text-sm text-muted-foreground">
                  {note.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="tabular-nums text-foreground">
              {position} of {total}
            </span>
          </div>
          <ProgressBar
            className="mt-2"
            value={total === 0 ? 0 : (markedCount / total) * 100}
            label={`${questionLabel} batch progress`}
            showValue
          />
        </div>
      </aside>

      {/* Actions */}
      <div className="lg:col-span-12">
        {flagging ? (
          <div className="rounded-xl border border-warning/40 bg-warning-subtle p-4">
            <label htmlFor="flag-reason" className="mb-2 block text-sm text-warning-foreground">
              Why is this going to a supervisor? They see this instead of the script.
            </label>
            <Input
              id="flag-reason"
              value={flagReason}
              onChange={(event) => setFlagReason(event.target.value)}
              className="mb-3 h-11"
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={flagReason.trim().length === 0}
                onClick={() => onFlag(flagReason)}
              >
                Send to supervisor
              </Button>
              <Button variant="ghost" onClick={() => setFlagging(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /*
            Pinned to the bottom of the viewport on a phone. The answer image and the four
            bands already fill a small screen, so a static bar would sit below the fold and
            the checker would scroll to submit on every single answer. From `lg` up there is
            room for it to sit in the flow.
          */
          <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center gap-2 border-t border-border bg-card p-3 shadow-lg sm:mx-0 sm:rounded-xl sm:border sm:shadow-sm lg:static">
            {onPrevious && (
              <Button variant="ghost" size="sm" onClick={onPrevious}>
                Previous
              </Button>
            )}
            {onSkip && (
              <Button variant="ghost" size="sm" onClick={onSkip}>
                Skip
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setFlagging(true)}>
              <Flag className="h-4 w-4 text-warning-foreground" aria-hidden />
              Flag
            </Button>

            {/* The chosen band reads under the buttons on a phone, beside them elsewhere. */}
            <span className="order-last w-full text-sm text-muted-foreground sm:order-none sm:ml-auto sm:w-auto">
              {band
                ? `${BAND_LABEL[band]} · ${marksForBand(rubric, band)} marks`
                : 'No band selected'}
            </span>

            <Button variant="primary" disabled={!band} onClick={submit}>
              Submit &amp; next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MarkingWorkspace;
