/**
 * Role editor (super admin) — create a custom role or view/edit an existing one.
 *
 * The core is the permission matrix: every action from PERMISSION_CATALOG grouped by
 * module, each a checkbox. Scopeable actions (e.g. students.manage) get an All / Own
 * institute selector when granted. A role may be tagged to one institute (owner) to make
 * it a custom institute-owned role. System roles render read-only.
 *
 * TODO: replace direct store calls with a rolesApi + React Query mutations.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { type PermissionAction, type PermissionGrant, type PermissionScope } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField } from '@/design-system/molecules/select-field';
import { PERMISSION_CATALOG, createRole, getRole, updateRole } from '@/services/roles.service';
import { INSTITUTE_OPTIONS } from '@/services/users.service';

interface ActionState {
  granted: boolean;
  scope: PermissionScope;
}
type GrantState = Record<PermissionAction, ActionState>;

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All institutes' },
  { value: 'own-institute', label: 'Own institute only' },
];

const OWNER_OPTIONS = [{ value: '', label: 'Global (all institutes)' }, ...INSTITUTE_OPTIONS];

/** Build the initial per-action state from an existing role's grants (or empty). */
function initialGrantState(grants: PermissionGrant[]): GrantState {
  const state = {} as GrantState;
  for (const meta of PERMISSION_CATALOG) {
    const existing = grants.find((g) => g.action === meta.action);
    state[meta.action] = {
      granted: Boolean(existing),
      scope: existing?.scope ?? 'all',
    };
  }
  return state;
}

export function RoleDetailPage(): React.ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const existing = isNew ? undefined : getRole(id);
  const readOnly = Boolean(existing?.isSystem);

  const [name, setName] = useState(existing?.name ?? '');
  const [ownerInstituteId, setOwnerInstituteId] = useState(existing?.instituteId ?? '');
  const [grantState, setGrantState] = useState<GrantState>(() =>
    initialGrantState(existing?.grants ?? []),
  );

  const modules = useMemo(() => [...new Set(PERMISSION_CATALOG.map((p) => p.module))], []);
  const grantedCount = Object.values(grantState).filter((s) => s.granted).length;

  const toggle = (action: PermissionAction): void => {
    setGrantState((prev) => ({
      ...prev,
      [action]: { ...prev[action], granted: !prev[action].granted },
    }));
  };
  const setScope = (action: PermissionAction, scope: PermissionScope): void => {
    setGrantState((prev) => ({ ...prev, [action]: { ...prev[action], scope } }));
  };

  const handleSave = (): void => {
    const grants: PermissionGrant[] = PERMISSION_CATALOG.filter(
      (m) => grantState[m.action].granted,
    ).map((m) => ({
      action: m.action,
      scope: m.scopeable ? grantState[m.action].scope : 'all',
    }));

    if (isNew) {
      createRole({
        name: name.trim(),
        grants,
        ...(ownerInstituteId ? { instituteId: ownerInstituteId } : {}),
      });
    } else if (id) {
      updateRole(id, { name: name.trim(), grants });
    }
    void navigate('/admin/roles');
  };

  const canSave = !readOnly && name.trim().length > 0 && grantedCount > 0;

  return (
    <>
      <PageHeader
        title={isNew ? 'Create Role' : existing ? existing.name : 'Role'}
        subtitle={
          readOnly
            ? 'System role — read-only'
            : 'Choose a name, optional owner, and the permissions this role grants'
        }
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void navigate('/admin/roles')}>
              {readOnly ? 'Back' : 'Cancel'}
            </Button>
            {!readOnly && (
              <Button variant="primary" disabled={!canSave} onClick={handleSave}>
                {isNew ? 'Create Role' : 'Save Changes'}
              </Button>
            )}
          </div>
        }
      />

      {!existing && !isNew ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Role not found.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 rounded-lg border border-border bg-card p-6 shadow-sm sm:grid-cols-2">
            <FormField
              id="roleName"
              name="roleName"
              label="Role Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={readOnly}
              required
            />
            <SelectField
              label="Owner"
              value={ownerInstituteId}
              onChange={setOwnerInstituteId}
              options={OWNER_OPTIONS}
              disabled={readOnly || !isNew}
            />
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">Permissions</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{grantedCount} selected</p>
            </div>

            <div className="divide-y divide-border">
              {modules.map((module) => (
                <div key={module} className="px-6 py-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {module}
                  </h3>
                  <div className="space-y-3">
                    {PERMISSION_CATALOG.filter((m) => m.module === module).map((meta) => {
                      const state = grantState[meta.action];
                      return (
                        <div
                          key={meta.action}
                          className="flex flex-wrap items-center justify-between gap-3"
                        >
                          <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-input accent-[var(--brand)]"
                              checked={state.granted}
                              disabled={readOnly}
                              onChange={() => toggle(meta.action)}
                            />
                            <span>
                              {meta.label}
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {meta.action}
                              </span>
                            </span>
                          </label>

                          {meta.scopeable && state.granted && (
                            <div className="w-56">
                              <SelectField
                                label="Scope"
                                value={state.scope}
                                onChange={(v) => setScope(meta.action, v as PermissionScope)}
                                options={SCOPE_OPTIONS}
                                disabled={readOnly}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RoleDetailPage;
