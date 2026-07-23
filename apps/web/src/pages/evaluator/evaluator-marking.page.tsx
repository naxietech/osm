/**
 * Marking one answer — opened by clicking an answer on the subject page.
 *
 * The page owns the flow (which answer is open, what happens after a mark) and the
 * service owns the rules (what a band is worth, what flagging does). The workspace
 * organism owns neither: it renders and reports back.
 *
 * Ownership is checked against the signed-in checker's own record, so an answer reached
 * by editing the URL is refused.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { type SubmitMarkDto } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { ChevronLeft } from '@/design-system/atoms/icon';
import { MarkingWorkspace } from '@/design-system/organisms/marking-workspace';
import { useCurrentChecker } from '@/hooks';
import { ROUTES } from '@/router/routes';
import {
  PLACEHOLDER_ANSWER_IMAGE,
  findScript,
  flagScript,
  listCheckerAnswers,
  markScript,
  nextAnswerInSubject,
} from '@/services/marking.service';

export function EvaluatorMarkingPage(): React.ReactElement {
  const navigate = useNavigate();
  const params = useParams<{ examId: string; subjectId: string; scriptId: string }>();
  const examId = params.examId ?? '';
  const subjectId = params.subjectId ?? '';
  const checker = useCurrentChecker();

  // Which answer is open. Starts at the one clicked, then follows the subject's queue.
  const [scriptId, setScriptId] = useState(params.scriptId ?? '');
  // The store is mutable and outside React, so a mark has to be pulled back in by hand.
  const [, setTick] = useState(0);

  const subjectPath = ROUTES.evaluator.workSubject
    .replace(':examId', examId)
    .replace(':subjectId', subjectId);

  const found = findScript(scriptId);
  const isOwn = Boolean(found && checker && found.batch.checkerId === checker.id);
  // The URL must agree with the answer it names, or a checker could reach one subject's
  // answer through another subject's path.
  const inScope = isOwn && found?.batch.examId === examId && found?.batch.subjectId === subjectId;

  if (!found || !inScope) {
    return (
      <>
        <PageHeader title="Answer not found" subtitle="This answer is not assigned to you" />
        <Button variant="ghost" onClick={() => void navigate(-1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Go back
        </Button>
      </>
    );
  }

  const { script, batch } = found;
  const answers = checker ? listCheckerAnswers(checker.id, examId, subjectId) : [];
  const position = answers.findIndex((a) => a.id === script.id) + 1;
  const markedCount = answers.filter((a) => a.status === 'marked').length;

  /** Move to the next answer still needing a mark, or back to the list when none is left. */
  const advance = (): void => {
    const next = checker
      ? nextAnswerInSubject(checker.id, examId, subjectId, script.id)
      : undefined;
    if (next) {
      setScriptId(next.id);
      setTick((t) => t + 1);
    } else {
      void navigate(subjectPath);
    }
  };

  const handleSubmit = (input: SubmitMarkDto): void => {
    markScript(script.id, input);
    advance();
  };

  const handleFlag = (reason: string): void => {
    flagScript(script.id, reason);
    advance();
  };

  const handlePrevious = (): void => {
    const index = answers.findIndex((a) => a.id === script.id);
    const earlier = index > 0 ? answers[index - 1] : undefined;
    if (earlier) {
      setScriptId(earlier.id);
      setTick((t) => t + 1);
    }
  };

  return (
    <>
      <PageHeader
        title={`${batch.subject} · ${batch.questionLabel}`}
        subtitle="You are marking one question across many candidates. Identity is never shown."
        actions={
          <Button variant="ghost" onClick={() => void navigate(subjectPath)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back to answers
          </Button>
        }
      />

      <MarkingWorkspace
        script={script}
        rubric={batch.rubric}
        subject={batch.subject}
        questionLabel={batch.questionLabel}
        position={position}
        total={answers.length}
        markedCount={markedCount}
        imageUrl={script.imageUrl ?? PLACEHOLDER_ANSWER_IMAGE}
        onSubmit={handleSubmit}
        onFlag={handleFlag}
        onSkip={advance}
        {...(position > 1 ? { onPrevious: handlePrevious } : {})}
        // TODO: replace with a proper in-page dialog; a native prompt is a rough edge.
        onRequestNoteText={() => window.prompt('Note to pin on the answer:')}
      />
    </>
  );
}

export default EvaluatorMarkingPage;
