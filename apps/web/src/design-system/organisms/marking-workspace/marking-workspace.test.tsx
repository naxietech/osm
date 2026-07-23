import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type MarkingBandOption, type MarkingScript } from '@oses/types';

import { MarkingWorkspace } from './marking-workspace';

const RUBRIC: MarkingBandOption[] = [
  { band: 'correct', marks: 12 },
  { band: 'partially-correct', marks: 8 },
  { band: 'partially-incorrect', marks: 4 },
  { band: 'incorrect', marks: 0 },
];

const SCRIPT: MarkingScript = {
  id: 'scr_1',
  batchId: 'batch_1',
  candidateRefId: 'anon-abc123',
  sequence: 3,
  status: 'pending',
};

function renderWorkspace(overrides: Partial<React.ComponentProps<typeof MarkingWorkspace>> = {}): {
  onSubmit: ReturnType<typeof vi.fn>;
  onFlag: ReturnType<typeof vi.fn>;
  rerender: (ui: React.ReactElement) => void;
} {
  const onSubmit = vi.fn();
  const onFlag = vi.fn();
  const { rerender } = render(
    <MarkingWorkspace
      script={SCRIPT}
      rubric={RUBRIC}
      subject="Physics"
      questionLabel="Q4"
      position={3}
      total={40}
      markedCount={26}
      imageUrl="data:image/png;base64,placeholder"
      onSubmit={onSubmit}
      onFlag={onFlag}
      {...overrides}
    />,
  );
  return { onSubmit, onFlag, rerender };
}

describe('MarkingWorkspace', () => {
  it('shows the four bands with what each is worth', () => {
    renderWorkspace();
    for (const option of RUBRIC) {
      const label = {
        correct: 'Correct',
        'partially-correct': 'Partially Correct',
        'partially-incorrect': 'Partially Incorrect',
        incorrect: 'Incorrect',
      }[option.band];
      const band = screen.getByRole('radio', { name: new RegExp('^' + label) });
      expect(band).toHaveTextContent(String(option.marks));
    }
  });

  // The candidate must not be identifiable from anything on this screen.
  it('identifies the script only by its anonymous reference', () => {
    renderWorkspace();
    expect(screen.getByAltText(/anon-abc123/)).toBeInTheDocument();
    expect(screen.queryByText(/anon-abc123/)).not.toBeInTheDocument();
  });

  it('cannot submit until a band is chosen', () => {
    const { onSubmit } = renderWorkspace();
    const submit = screen.getByRole('button', { name: /submit/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText('No band selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /^Partially Correct/ }));
    expect(submit).toBeEnabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // The band alone goes back — the service looks the marks up. If the workspace sent a
  // number, a screen could award something the rubric does not allow.
  it('submits the band, never a mark of its own', () => {
    const { onSubmit } = renderWorkspace();
    fireEvent.click(screen.getByRole('radio', { name: /^Correct/ }));
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [input] = onSubmit.mock.calls[0] as [Record<string, unknown>];
    expect(input.band).toBe('correct');
    expect(input).not.toHaveProperty('awardedMarks');
    expect(input).not.toHaveProperty('marks');
  });

  it('sends a trimmed comment and omits an empty one', () => {
    const { onSubmit } = renderWorkspace();
    fireEvent.click(screen.getByRole('radio', { name: /^Correct/ }));
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect((onSubmit.mock.calls[0] as [Record<string, unknown>])[0]).not.toHaveProperty('comment');

    fireEvent.change(screen.getByLabelText(/comment \(optional\)/i), {
      target: { value: '  Units missing.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect((onSubmit.mock.calls[1] as [Record<string, unknown>])[0].comment).toBe('Units missing.');
  });

  it('shows the running position in the batch', () => {
    renderWorkspace();
    expect(screen.getByText('3 of 40')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Q4 batch progress/ })).toHaveAttribute(
      'aria-valuenow',
      '65',
    );
  });

  describe('keyboard shortcuts', () => {
    it('picks a band with 1 to 4', () => {
      renderWorkspace();
      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByRole('radio', { name: /^Correct/ })).toHaveAttribute(
        'aria-checked',
        'true',
      );

      fireEvent.keyDown(window, { key: '4' });
      expect(screen.getByRole('radio', { name: /^Incorrect/ })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('submits on Enter once a band is chosen', () => {
      const { onSubmit } = renderWorkspace();
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();

      fireEvent.keyDown(window, { key: '2' });
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect((onSubmit.mock.calls[0] as [Record<string, unknown>])[0].band).toBe(
        'partially-correct',
      );
    });

    it('opens the flag box on F', () => {
      renderWorkspace();
      fireEvent.keyDown(window, { key: 'f' });
      expect(screen.getByLabelText(/why is this going to a supervisor/i)).toBeInTheDocument();
    });

    // Typing "1" into the comment box must type a 1, not silently regrade the answer.
    it('does not steal keys while the checker is typing', () => {
      const { onSubmit } = renderWorkspace();
      const comment = screen.getByLabelText(/comment \(optional\)/i);
      fireEvent.keyDown(comment, { key: '1' });
      expect(screen.getByRole('radio', { name: /^Correct/ })).toHaveAttribute(
        'aria-checked',
        'false',
      );

      fireEvent.keyDown(comment, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('flagging', () => {
    it('needs a reason before it can be sent', () => {
      const { onFlag } = renderWorkspace();
      fireEvent.click(screen.getByRole('button', { name: /flag/i }));
      const send = screen.getByRole('button', { name: /send to supervisor/i });
      expect(send).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/why is this going to a supervisor/i), {
        target: { value: 'Scan unreadable' },
      });
      expect(send).toBeEnabled();
      fireEvent.click(send);
      expect(onFlag).toHaveBeenCalledWith('Scan unreadable');
    });

    it('can be cancelled without flagging', () => {
      const { onFlag } = renderWorkspace();
      fireEvent.click(screen.getByRole('button', { name: /flag/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      expect(onFlag).not.toHaveBeenCalled();
    });
  });

  describe('drawing tools', () => {
    it('offers the full toolset and marks the active one', () => {
      renderWorkspace();
      for (const label of [
        'Pen',
        'Highlighter',
        'Rectangle',
        'Ellipse',
        'Arrow',
        'Tick',
        'Cross',
        'Comment pin',
        'Eraser',
      ]) {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
      }

      fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }));
      expect(screen.getByRole('button', { name: 'Highlighter' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('disables undo and clear until something is drawn', () => {
      renderWorkspace();
      expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
    });

    it('enables undo once the script already carries annotations', () => {
      renderWorkspace({
        script: {
          ...SCRIPT,
          annotations: [
            {
              id: 'a1',
              tool: 'tick',
              points: [{ x: 0.5, y: 0.5 }],
              color: 'success',
              createdAt: '2026-07-21T10:00:00.000Z',
            },
          ],
        },
      });
      expect(screen.getByRole('button', { name: /undo/i })).toBeEnabled();
    });
  });

  // The drawing layer is aria-hidden, so a pinned note would otherwise be invisible to
  // anyone who cannot see the image.
  it('lists pinned notes as readable text', () => {
    renderWorkspace({
      script: {
        ...SCRIPT,
        annotations: [
          {
            id: 'n1',
            tool: 'note',
            points: [{ x: 0.2, y: 0.3 }],
            color: 'warning',
            text: 'Show your working for part b',
            createdAt: '2026-07-21T10:00:00.000Z',
          },
        ],
      },
    });
    expect(screen.getByText('Pinned notes')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list')).getByText('Show your working for part b'),
    ).toBeInTheDocument();
  });

  // Moving on must not carry the previous answer's grading across — that would award one
  // candidate's band to the next candidate.
  it('resets the marking state when it moves to another script', () => {
    const { rerender } = renderWorkspace();
    fireEvent.click(screen.getByRole('radio', { name: /^Correct/ }));
    fireEvent.change(screen.getByLabelText(/comment \(optional\)/i), {
      target: { value: 'Good work' },
    });

    rerender(
      <MarkingWorkspace
        script={{ ...SCRIPT, id: 'scr_2', candidateRefId: 'anon-def456', sequence: 4 }}
        rubric={RUBRIC}
        subject="Physics"
        questionLabel="Q4"
        position={4}
        total={40}
        markedCount={27}
        imageUrl="data:image/png;base64,placeholder"
        onSubmit={vi.fn()}
        onFlag={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: /^Correct/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByLabelText(/comment \(optional\)/i)).toHaveValue('');
    expect(screen.getByText('No band selected')).toBeInTheDocument();
  });

  it('prefills from a script that was already marked', () => {
    renderWorkspace({
      script: { ...SCRIPT, status: 'marked', band: 'partially-correct', comment: 'Half right' },
    });
    expect(screen.getByRole('radio', { name: /^Partially Correct/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByLabelText(/comment \(optional\)/i)).toHaveValue('Half right');
  });
});
