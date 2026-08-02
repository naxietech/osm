/**
 * Add User (super admin) — the only place logins are created.
 *
 * Thin by design: this page fetches the role catalogue, hands it to the UserForm organism,
 * and turns the submitted values into a `POST /users`. All validation and the institute
 * rule live in the organism.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/widgets';
import { Alert } from '@/design-system/molecules/alert';
import { UserForm, type UserFormValues } from '@/design-system/organisms/user-form';
import { useRoles } from '@/hooks/use-roles';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { INSTITUTE_OPTIONS } from '@/services/institute.service';
import { usersService } from '@/services/users.service';

export function UserAddPage(): React.ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const backToList = (): void => void navigate(ROUTES.admin.users);

  const { roles, isError: rolesFailed, error: rolesError } = useRoles();

  const createMutation = useMutation({
    mutationFn: usersService.createUser,
    onSuccess: async () => {
      // Mark every page of the list stale before leaving. Without this the list serves
      // its cache (30s staleTime, see lib/query-client) and the new user is missing —
      // intermittently, because whether it refetches depends on how long you spent on
      // this form. Awaiting means the list renders with the new row already in place.
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      backToList();
    },
  });

  const handleSubmit = (values: UserFormValues): void => {
    createMutation.mutate({
      fullName: values.fullName,
      email: values.email,
      roleId: values.roleId,
      password: values.password,
      ...(values.instituteId ? { instituteId: values.instituteId } : {}),
    });
  };

  return (
    <>
      <PageHeader title="Add User" subtitle="Create a login and assign a role" />

      {rolesFailed && (
        <Alert tone="danger" className="mb-4">
          {apiErrorMessage(rolesError)}
        </Alert>
      )}

      <div className="max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <UserForm
          roles={roles}
          instituteOptions={INSTITUTE_OPTIONS}
          onSubmit={handleSubmit}
          onCancel={backToList}
          isSubmitting={createMutation.isPending}
          submitError={createMutation.isError ? apiErrorMessage(createMutation.error) : null}
        />
      </div>
    </>
  );
}

export default UserAddPage;
