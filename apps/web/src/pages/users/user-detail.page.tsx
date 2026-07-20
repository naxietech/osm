/**
 * Add User (super admin) — the only place logins are created. Pick a role (system or
 * custom); if the role is institute-scoped (any own-institute grant, or an institute-
 * owned custom role) an institute must be chosen. Many users can share one institute.
 *
 * TODO: replace direct store calls with a usersApi + React Query mutation + real email
 * uniqueness / password handling (created server-side).
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField } from '@/design-system/molecules/select-field';
import { getRole, listRoles } from '@/services/roles.service';
import { INSTITUTE_OPTIONS, createUser } from '@/services/users.service';

export function UserDetailPage(): React.ReactElement {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [instituteId, setInstituteId] = useState('');

  const roleOptions = useMemo(() => listRoles().map((r) => ({ value: r.id, label: r.name })), []);

  const selectedRole = roleId ? getRole(roleId) : undefined;
  const needsInstitute = Boolean(
    selectedRole?.instituteId || selectedRole?.grants.some((g) => g.scope === 'own-institute'),
  );

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSave =
    fullName.trim().length > 0 &&
    emailValid &&
    roleId.length > 0 &&
    (!needsInstitute || instituteId.length > 0);

  const handleSave = (): void => {
    createUser({
      fullName: fullName.trim(),
      email: email.trim(),
      roleId,
      ...(needsInstitute && instituteId ? { instituteId } : {}),
    });
    void navigate('/admin/users');
  };

  return (
    <>
      <PageHeader
        title="Add User"
        subtitle="Create a login and assign a role"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void navigate('/admin/users')}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={handleSave}>
              Create User
            </Button>
          </div>
        }
      />

      <div className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <FormField
          id="fullName"
          name="fullName"
          label="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <FormField
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          label="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <SelectField
          label="Role"
          value={roleId}
          onChange={(v) => setRoleId(v)}
          options={roleOptions}
          required
        />
        {needsInstitute && (
          <SelectField
            label="Institute"
            value={instituteId}
            onChange={(v) => setInstituteId(v)}
            options={INSTITUTE_OPTIONS}
            required
          />
        )}
        <p className="text-xs text-muted-foreground">
          The initial password is set by the super admin and shared with the user (mock — not wired
          yet).
        </p>
      </div>
    </>
  );
}

export default UserDetailPage;
