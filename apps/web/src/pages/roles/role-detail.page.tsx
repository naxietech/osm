/**
 * Role detail (super admin) — what one role is allowed to do, read from the API.
 *
 * The permission matrix shows every action from PERMISSION_CATALOG grouped by module,
 * ticked where the role holds it, with the scope (all institutes / own institute only)
 * beside each granted action.
 *
 * Read-only. The editor this page used to be still exists in git history and the shapes
 * it needs (`CreateRoleDto`, `UpdateRoleDto`) are still in @oses/types, but the API has
 * no POST/PATCH/DELETE for roles — so there is nothing to save to. Restore the editing
 * controls when those endpoints land.
 */
import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import type { PermissionGrant } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Check, Lock } from '@/design-system/atoms/icon';
import { Spinner } from '@/design-system/atoms/spinner';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { instituteName } from '@/services/institute.service';
import { PERMISSION_CATALOG, rolesService } from '@/services/roles.service';

const SCOPE_LABEL: Record<string, string> = {
  all: 'All institutes',
  'own-institute': 'Own institute only',
};

export function RoleDetailPage(): React.ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => rolesService.listRoles() });
  const role = rolesQuery.data?.find((r) => r.id === id);

  const modules = useMemo(() => [...new Set(PERMISSION_CATALOG.map((p) => p.module))], []);
  const grantFor = (action: string): PermissionGrant | undefined =>
    role?.grants.find((g) => g.action === action);

  const backToList = (): void => void navigate(ROUTES.admin.roles);

  if (rolesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (rolesQuery.isError) {
    return (
      <div
        role="alert"
        className="rounded-md bg-danger-subtle px-4 py-3 text-sm text-danger-foreground"
      >
        {apiErrorMessage(rolesQuery.error)}
      </div>
    );
  }

  if (!role) {
    return (
      <>
        <PageHeader title="Role" subtitle="Not found" />
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          That role no longer exists.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={role.name}
        subtitle={
          role.instituteId
            ? `Owned by ${instituteName(role.instituteId)} — ${role.grants.length} permissions`
            : `${role.isSystem ? 'System role' : 'Custom role'} — ${role.grants.length} permissions`
        }
        actions={
          <Button variant="ghost" onClick={backToList}>
            Back
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <Lock size={14} className="text-muted-foreground" aria-hidden />
          <p className="text-xs text-muted-foreground">
            Roles are defined by the server and cannot be edited here.
          </p>
        </div>

        <div className="divide-y divide-border">
          {modules.map((module) => (
            <div key={module} className="px-6 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {module}
              </h3>
              <div className="space-y-2">
                {PERMISSION_CATALOG.filter((m) => m.module === module).map((meta) => {
                  const grant = grantFor(meta.action);
                  return (
                    <div
                      key={meta.action}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span
                        className={
                          grant ? 'flex items-center gap-2' : 'flex items-center gap-2 opacity-50'
                        }
                      >
                        {grant ? (
                          <Check size={16} className="text-success" aria-label="Granted" />
                        ) : (
                          <span
                            className="inline-block h-4 w-4 rounded border border-border"
                            aria-label="Not granted"
                          />
                        )}
                        {meta.label}
                        <span className="font-mono text-xs text-muted-foreground">
                          {meta.action}
                        </span>
                      </span>

                      {grant && meta.scopeable && (
                        <span className="text-xs text-muted-foreground">
                          {SCOPE_LABEL[grant.scope] ?? grant.scope}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default RoleDetailPage;
