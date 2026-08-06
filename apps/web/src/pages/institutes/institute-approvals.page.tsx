/**
 * Institute Approvals (super admin) — the queue of registrations awaiting review.
 *
 * **No decision is taken here.** Each card summarises an application and sends you to its detail
 * screen, where Approve & Register and Reject live behind confirmation modals. Approving creates
 * a login and draws a permanent institute number; that is not an action to leave one careless
 * click away in a list, and the detail screen is where the govt code, contact number and
 * duplicate warning are all in front of you to check first.
 *
 * Gated by `institutes.manage`.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { useInstitutes } from '@/hooks/use-institutes';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';

/** How long an application has been waiting, in the roughest useful unit. */
function waitingFor(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function InstituteApprovalsPage(): React.ReactElement {
  const navigate = useNavigate();

  // Oldest first would be fairer, but the API orders newest-first everywhere and one screen
  // disagreeing about ordering is more confusing than it is fair.
  const pendingQuery = useInstitutes({ status: 'pending', limit: 100 });
  const pending = pendingQuery.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Institute Approvals"
        subtitle="Registrations waiting to be checked and approved"
      />

      {pendingQuery.isError && (
        <Alert tone="danger" className="mb-4">
          {apiErrorMessage(pendingQuery.error)}
        </Alert>
      )}

      {pendingQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Nothing waiting. New registrations from the public link appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((inst) => {
            const displayName = inst.branch
              ? `${inst.instituteName}, ${inst.branch}`
              : inst.instituteName;

            return (
              <div
                key={inst.id}
                className="rounded-lg border border-border bg-card p-5 shadow-sm md:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{displayName}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      <span className="font-mono">{inst.instituteCode}</span> · {inst.city} ·
                      applied {waitingFor(inst.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void navigate(`${ROUTES.admin.institutes}/${inst.id}`)}
                  >
                    Review
                  </Button>
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Detail label="Type" value={inst.institutionType.replace(/_/g, ' ')} />
                  <Detail label="Province" value={inst.province.toUpperCase()} />
                  <Detail
                    label="Contact"
                    value={`${inst.contactPersonName} (${inst.contactPersonDesignation})`}
                  />
                  <Detail label="Phone" value={inst.contactPhone} />
                </dl>
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
