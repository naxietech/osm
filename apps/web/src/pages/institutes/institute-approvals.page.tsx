/**
 * Institute Approvals (super admin) — the queue of public self-registrations awaiting
 * review. Each card shows the submitted details + category question answers. Approve
 * and Reject both go through an inline confirm step (Reject captures a reason), and the
 * result is announced in a success banner. Gated by `institutes.manage`.
 */
import React, { useState } from 'react';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Alert } from '@/design-system/molecules/alert';
import { getInstituteCategory } from '@/services/institute-category.service';
import {
  approveInstitute,
  listPendingInstitutes,
  rejectInstitute,
} from '@/services/institute.service';

type CardAction = 'approve' | 'reject';

function questionLabel(categoryId: string, questionId: string): string {
  return (
    getInstituteCategory(categoryId)?.questions.find((q) => q.id === questionId)?.text ?? questionId
  );
}

export function InstituteApprovalsPage(): React.ReactElement {
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);
  const pending = listPendingInstitutes();

  // Which card is mid-action, and the reject reason being typed.
  const [action, setAction] = useState<{ id: string; kind: CardAction } | null>(null);
  const [reason, setReason] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const startAction = (id: string, kind: CardAction): void => {
    setAction({ id, kind });
    setReason('');
  };
  const cancelAction = (): void => {
    setAction(null);
    setReason('');
  };

  const confirmApprove = (id: string, name: string): void => {
    approveInstitute(id);
    setBanner(`${name} approved — the institute is now active.`);
    cancelAction();
    refresh();
  };
  const confirmReject = (id: string, name: string): void => {
    rejectInstitute(id, reason);
    setBanner(
      reason.trim().length > 0 ? `${name} rejected — reason recorded.` : `${name} rejected.`,
    );
    cancelAction();
    refresh();
  };

  return (
    <>
      <PageHeader
        title="Institute Approvals"
        subtitle="Review and approve institutes that registered via the public link"
      />

      {banner && <Alert className="mb-6">{banner}</Alert>}

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          No pending registrations.
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((inst) => {
            const isActing = action?.id === inst.id;
            const displayName = `${inst.instituteName}${inst.branch ? `, ${inst.branch}` : ''}`;
            return (
              <div key={inst.id} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{displayName}</h2>
                    <p className="text-xs text-muted-foreground">
                      Code {inst.instituteCode} ·{' '}
                      {getInstituteCategory(inst.categoryId)?.name ?? '—'}
                    </p>
                  </div>
                  {!isActing && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startAction(inst.id, 'reject')}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => startAction(inst.id, 'approve')}
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </div>

                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Detail label="Type" value={inst.institutionType.replace(/_/g, ' ')} />
                  <Detail label="Level" value={inst.instituteLevel.replace(/_/g, ' ')} />
                  <Detail label="Gender" value={inst.category.replace(/_/g, ' ')} />
                  <Detail
                    label="City / Province"
                    value={`${inst.city} · ${inst.province.toUpperCase()}`}
                  />
                  <Detail label="Address" value={inst.address} />
                  <Detail
                    label="Contact"
                    value={`${inst.contactPersonName} (${inst.contactPersonDesignation})`}
                  />
                  <Detail label="Email" value={inst.contactEmail} />
                  <Detail label="Phone" value={inst.contactPhone} />
                </dl>

                {inst.questionAnswers.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Category questions
                    </p>
                    <ul className="space-y-1 text-sm">
                      {inst.questionAnswers.map((a) => (
                        <li key={a.questionId}>
                          <span className="text-muted-foreground">
                            {questionLabel(inst.categoryId, a.questionId)}:
                          </span>{' '}
                          <span className="font-medium text-foreground">{a.values.join(', ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Inline confirm strip */}
                {isActing && action?.kind === 'approve' && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <p className="text-sm text-foreground">
                      Approve <span className="font-medium">{displayName}</span>? It becomes active
                      immediately.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelAction}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => confirmApprove(inst.id, displayName)}
                      >
                        Confirm approve
                      </Button>
                    </div>
                  </div>
                )}
                {isActing && action?.kind === 'reject' && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <label
                      htmlFor={`reject-reason-${inst.id}`}
                      className="mb-1.5 block text-sm font-medium text-foreground"
                    >
                      Reason for rejecting <span className="font-semibold">{displayName}</span>
                      <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <textarea
                      id={`reject-reason-${inst.id}`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      placeholder="e.g. Institute code does not match board records"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelAction}>
                        Cancel
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => confirmReject(inst.id, displayName)}
                      >
                        Confirm reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

export default InstituteApprovalsPage;
