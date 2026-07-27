import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ESheetTemplateForm, type ESheetTemplateFormValue } from './e-sheet-template-form';

const baseProps = {
  mode: 'create' as const,
  isNameTaken: () => false,
  onCancel: vi.fn(),
};

/** An MCQ question with 2 bubble rows and a short-answer question with 2 written parts. */
const filledValue: ESheetTemplateFormValue = {
  name: 'Science Paper',
  instructions: 'Write inside the boxes.',
  questions: [
    {
      questionNo: '1',
      type: 'mcq',
      optionCount: '4',
      subPartLabelStyle: 'alpha',
      defaultSpace: 'quarter',
      subPartCount: '2',
      answers: [
        { space: 'quarter' as const, maxMarks: '1' },
        { space: 'quarter' as const, maxMarks: '1' },
      ],
    },
    {
      questionNo: '2',
      type: 'short-answer',
      optionCount: '4',
      subPartLabelStyle: 'alpha',
      defaultSpace: 'quarter',
      subPartCount: '2',
      answers: [
        { space: 'quarter' as const, maxMarks: '3' },
        { space: 'quarter' as const, maxMarks: '4' },
      ],
    },
  ],
};

/** Required FormFields append an asterisk, so labels are matched by prefix. */
const LABELS = {
  name: /^Template Name/,
  howMany: /^How many questions/,
  questionNo: /^Q No/,
  subParts: /^Sub-parts/,
} as const;

function typeIn(label: RegExp, value: string): void {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

function valuesOf(label: RegExp): string[] {
  return screen.getAllByLabelText(label).map((el) => (el as HTMLInputElement).value);
}

/** Type a sub-part count into question `qi` and press its Apply button. */
function applySubParts(qi: number, value: string): void {
  const field = screen.getAllByLabelText(LABELS.subParts)[qi] as HTMLInputElement;
  fireEvent.change(field, { target: { value } });
  fireEvent.click(screen.getAllByRole('button', { name: /^Apply$/i })[qi] as HTMLElement);
}

// Formik validates asynchronously, so error-driven assertions are awaited.
describe('ESheetTemplateForm', () => {
  it('opens clean — no field complains before the user has touched anything', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} />);

    expect(screen.getByText(/No questions yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Template name is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Add at least one question/i)).not.toBeInTheDocument();
  });

  it('generates the typed number of questions, auto-numbered', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} />);

    typeIn(LABELS.howMany, '3');
    fireEvent.click(screen.getByRole('button', { name: /^Generate questions$/i }));

    expect(valuesOf(LABELS.questionNo)).toEqual(['1', '2', '3']);
    expect(screen.queryByText(/No questions yet/i)).not.toBeInTheDocument();
  });

  it('will not generate for a count that is not a sensible whole number', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} />);
    const generate = screen.getByRole('button', { name: /^Generate questions$/i });

    expect(generate).toBeDisabled(); // blank
    typeIn(LABELS.howMany, '0');
    expect(generate).toBeDisabled();
    typeIn(LABELS.howMany, 'abc');
    expect(generate).toBeDisabled();
    typeIn(LABELS.howMany, '500'); // above the 100 cap
    expect(generate).toBeDisabled();

    typeIn(LABELS.howMany, '2');
    expect(generate).toBeEnabled();
  });

  it('starts a new question as an MCQ with one bubble row', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Question/i }));

    expect(valuesOf(LABELS.subParts)).toEqual(['1']);
    // MCQ shows no line count, and says so
    expect(screen.getByText(/machine-read bubbles, no checker/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/writing space/i)).not.toBeInTheDocument();
  });

  it('resizes a question to the typed sub-part count on Apply, keeping filled rows', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} initialValue={filledValue} />);

    // Q2 (short answer) grows 2 -> 3; its filled marks survive and the new row is blank
    applySubParts(1, '3');

    expect(screen.getAllByLabelText(/marks$/i).map((el) => (el as HTMLInputElement).value)).toEqual(
      ['1', '1', '3', '4', ''],
    );
  });

  it('shrinks a question from the end on Apply', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} initialValue={filledValue} />);

    applySubParts(1, '1');

    expect(screen.getByLabelText(/^Q\. No\. 2 marks/i)).toBeInTheDocument();
    // Q2 now has a single answer, so it is labelled "Q2" rather than "Q2(a)"
    expect(screen.queryByLabelText(/^Q\. No\. 2 Part \(b\) marks/i)).not.toBeInTheDocument();
  });

  it('leaves the rows alone while the count is only being typed', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} initialValue={filledValue} />);

    // Raising 2 to 12 passes through "1"; nothing may be deleted on the way through.
    const field = screen.getAllByLabelText(LABELS.subParts)[1] as HTMLInputElement;
    fireEvent.change(field, { target: { value: '1' } });
    fireEvent.change(field, { target: { value: '12' } });

    expect(screen.getByLabelText(/^Q\. No\. 2 Part \(a\) marks/i)).toHaveValue('3');
    expect(screen.getByLabelText(/^Q\. No\. 2 Part \(b\) marks/i)).toHaveValue('4');

    fireEvent.click(screen.getAllByRole('button', { name: /^Apply$/i })[1] as HTMLElement);
    expect(screen.getAllByLabelText(/marks$/i)).toHaveLength(14); // 2 MCQ + 12
  });

  it('will not save a sub-part count the examiner forgot to apply', async () => {
    const onSave = vi.fn();
    render(<ESheetTemplateForm {...baseProps} onSave={onSave} initialValue={filledValue} />);

    const field = screen.getAllByLabelText(LABELS.subParts)[1] as HTMLInputElement;
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.blur(field);

    expect(await screen.findByText(/Press Apply to use this count/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());
  });

  it('labels a lone sub-part "Q2" and several "Q2(a)", "Q2(b)"', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} initialValue={filledValue} />);

    expect(screen.getByLabelText(/^Q\. No\. 2 Part \(a\) writing space/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Q\. No\. 2 Part \(b\) writing space/i)).toBeInTheDocument();
  });

  it('offers a space picker per written answer, and says what it buys', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} initialValue={filledValue} />);

    expect(screen.getAllByLabelText(/writing space$/i)).toHaveLength(2); // Q2 only
    // both inherit the question's quarter side, which is 5 ruled lines
    expect(screen.getAllByText('5 lines')).toHaveLength(2);
  });

  it('applies the question default to every sub-part until one overrides it', async () => {
    const onSave = vi.fn();
    render(<ESheetTemplateForm {...baseProps} onSave={onSave} initialValue={filledValue} />);

    // Q2(b) alone is given a full side; Q2(a) keeps the question's quarter
    fireEvent.change(screen.getByLabelText(/^Q\. No\. 2 Part \(b\) writing space/i), {
      target: { value: 'full' },
    });

    expect(await screen.findByText('29 lines')).toBeInTheDocument();
    expect(screen.getAllByText('5 lines')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const dto = onSave.mock.calls[0]?.[0] as {
      questions: { defaultSpace?: string; answers: { space?: string }[] }[];
    };
    expect(dto.questions[1]?.answers.map((a) => a.space)).toEqual(['quarter', 'full']);
  });

  it('swaps a question to writing space when its type changes off MCQ', async () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} initialValue={filledValue} />);

    // Q1 is MCQ: no line inputs for it, so only Q2's two exist
    expect(screen.getAllByLabelText(/writing space$/i)).toHaveLength(2);

    const typeTrigger = screen.getAllByLabelText(/^Type/i, { selector: 'button' })[0];
    fireEvent.click(typeTrigger as Element);
    fireEvent.click(await screen.findByText('Long answer'));

    // Q1's two rows gain space pickers, inheriting the question's default
    await waitFor(() => expect(screen.getAllByLabelText(/writing space$/i)).toHaveLength(4));
    expect(screen.getByLabelText(/^Q\. No\. 1 Part \(a\) writing space/i)).toHaveValue('quarter');
  });

  it('reports the live totals — answers, marks and the page count the engine works out', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} initialValue={filledValue} />);

    // 4 answers, 1+1+3+4 = 9 marks. Three pages: the cover, then one per question.
    const summary = screen.getByText(/total marks/i);
    expect(summary.textContent?.replace(/\s+/g, ' ')).toContain(
      '4 answers · 9 total marks · 3 pages',
    );
  });

  it('sets every sub-part from the question picker, leaving deliberate overrides alone', async () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} initialValue={filledValue} />);

    // give Q2(b) its own size first
    fireEvent.change(screen.getByLabelText(/^Q\. No\. 2 Part \(b\) writing space/i), {
      target: { value: 'full' },
    });

    // now move the question's default: (a) follows, (b) keeps its override
    fireEvent.click(screen.getByLabelText(/^Space for every sub-part/i, { selector: 'button' }));
    // the question-level option carries the line count too, so it is unambiguous against
    // the bare "½ side" entries in each row's own picker
    fireEvent.click(await screen.findByText(/½ side — \d+ lines/));

    await waitFor(() =>
      expect(screen.getByLabelText(/^Q\. No\. 2 Part \(a\) writing space/i)).toHaveValue('half'),
    );
    expect(screen.getByLabelText(/^Q\. No\. 2 Part \(b\) writing space/i)).toHaveValue('full');
  });

  it('numbers each question independently — roman on one leaves the other alone', async () => {
    const onSave = vi.fn();
    render(<ESheetTemplateForm {...baseProps} onSave={onSave} initialValue={filledValue} />);

    expect(screen.getByLabelText(/^Q\. No\. 2 Part \(a\) writing space/i)).toBeInTheDocument();

    // switch only Q2 (the second numbering control) to roman
    const styleTriggers = screen.getAllByLabelText(/^Sub-part numbering/i, { selector: 'button' });
    expect(styleTriggers).toHaveLength(2); // one per multi-part question
    fireEvent.click(styleTriggers[1] as Element);
    fireEvent.click(await screen.findByText(/Roman/i));

    expect(
      await screen.findByLabelText(/^Q\. No\. 2 Part \(i\) writing space/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Q\. No\. 2 Part \(a\) writing space/i),
    ).not.toBeInTheDocument();
    // Q1 still uses letters
    expect(screen.getByLabelText(/^Q\. No\. 1 Part \(a\) marks/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const dto = onSave.mock.calls[0]?.[0] as {
      questions: { subPartLabelStyle: string }[];
    };
    expect(dto.questions.map((q) => q.subPartLabelStyle)).toEqual(['alpha', 'roman']);
  });

  it('offers no numbering control for a question with a single sub-part', () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Question/i }));

    // one sub-part means the answer is just "Q1" — there is nothing to number
    expect(
      screen.queryByLabelText(/^Sub-part numbering/i, { selector: 'button' }),
    ).not.toBeInTheDocument();
  });

  it('reports a duplicate template name through the name field', async () => {
    render(<ESheetTemplateForm {...baseProps} onSave={vi.fn()} isNameTaken={() => true} />);

    typeIn(LABELS.name, 'Science Paper');

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('flags the second use of a question number and blocks saving', async () => {
    const onSave = vi.fn();
    render(<ESheetTemplateForm {...baseProps} onSave={onSave} initialValue={filledValue} />);

    const second = screen.getAllByLabelText(LABELS.questionNo)[1] as HTMLInputElement;
    fireEvent.change(second, { target: { value: '1' } });

    expect(await screen.findByText(/^Duplicate$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Template/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());
  });

  it('refuses to save a template with no questions', async () => {
    const onSave = vi.fn();
    render(<ESheetTemplateForm {...baseProps} onSave={onSave} />);

    typeIn(LABELS.name, 'Empty Template');
    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }));

    expect(await screen.findByText(/Add at least one question/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('refuses marks that are out of range or not whole', async () => {
    const onSave = vi.fn();
    render(<ESheetTemplateForm {...baseProps} onSave={onSave} initialValue={filledValue} />);

    const marks = screen.getByLabelText(/^Q\. No\. 2 Part \(a\) marks/i);
    fireEvent.change(marks, { target: { value: '0' } });
    fireEvent.blur(marks);
    expect(await screen.findByText(/Marks must be between 1 and 500/i)).toBeInTheDocument();

    fireEvent.change(marks, { target: { value: '2.5' } });
    fireEvent.blur(marks);
    expect(await screen.findByText(/Marks must be a whole number/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());
  });

  it('submits a parsed DTO — space only where a sub-part overrides its question', async () => {
    const onSave = vi.fn();
    render(<ESheetTemplateForm {...baseProps} onSave={onSave} initialValue={filledValue} />);

    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      name: 'Science Paper',
      instructions: 'Write inside the boxes.',
      questions: [
        {
          questionNo: 1,
          type: 'mcq',
          optionCount: 4,
          subPartLabelStyle: 'alpha',
          answers: [{ maxMarks: 1 }, { maxMarks: 1 }],
        },
        {
          questionNo: 2,
          type: 'short-answer',
          subPartLabelStyle: 'alpha',
          defaultSpace: 'quarter',
          answers: [
            { maxMarks: 3, space: 'quarter' },
            { maxMarks: 4, space: 'quarter' },
          ],
        },
      ],
    });
  });

  it('omits instructions when they are left blank', async () => {
    const onSave = vi.fn();
    render(
      <ESheetTemplateForm
        {...baseProps}
        onSave={onSave}
        initialValue={{ ...filledValue, instructions: '   ' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('instructions');
  });

  it('reports the draft upward so the page can preview it', async () => {
    const onDraftChange = vi.fn();
    render(
      <ESheetTemplateForm
        {...baseProps}
        onSave={vi.fn()}
        initialValue={filledValue}
        onDraftChange={onDraftChange}
      />,
    );

    await waitFor(() => expect(onDraftChange).toHaveBeenCalled());
    const draft = onDraftChange.mock.calls.at(-1)?.[0] as { questions: unknown[] };
    expect(draft.questions).toHaveLength(2);

    // editing a value reports a fresh draft
    onDraftChange.mockClear();
    const marks = screen.getByLabelText(/^Q\. No\. 2 Part \(a\) marks/i);
    fireEvent.change(marks, { target: { value: '5' } });
    await waitFor(() => expect(onDraftChange).toHaveBeenCalled());
  });

  it('shows the parent’s save failure', () => {
    render(
      <ESheetTemplateForm
        {...baseProps}
        mode="edit"
        initialValue={filledValue}
        onSave={vi.fn()}
        submitError="A template with this name already exists"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
  });
});
