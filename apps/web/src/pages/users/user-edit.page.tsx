/**
 * Edit User (super admin) — change an account's email, name, role or institute.
 *
 * A separate screen rather than a dialog because it is where the two irreversible-feeling
 * actions live: a role change (which signs the user out everywhere) and delete. Both want
 * room to explain themselves.
 *
 * Password and status are not edited here. Each has its own endpoint because each has side
 * effects, and the list screen already offers them per row.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UpdateUserDto } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { UserForm, type UserFormValues } from '@/design-system/organisms/user-form';
import { useAuth } from '@/hooks/use-auth';
import { useRoles } from '@/hooks/use-roles';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { INSTITUTE_OPTIONS } from '@/services/institute.service';
import { usersService } from '@/services/users.service';

/**
 * The patch to send: only what actually changed, because `PATCH /users/:id` rejects an empty
 * body and treats every key present as a deliberate change.
 *
 * `instituteId` is the one field with three meanings rather than two — absent leaves the link
 * alone, `null` unlinks. Sending `''` would be neither, so a cleared picker becomes `null`.
 */
function buildPatch(
  values: UserFormValues,
  original: { email: string; fullName: string; roleId: string; instituteId: string },
): UpdateUserDto {
  const patch: UpdateUserDto = {};
  if (values.email !== original.email) patch.email = values.email;
  if (values.fullName !== original.fullName) patch.fullName = values.fullName;
  if (values.roleId !== original.roleId) patch.roleId = values.roleId;

  const nextInstitute = values.instituteId ?? '';
  if (nextInstitute !== original.instituteId) patch.instituteId = nextInstitute || null;

  return patch;
}

export function UserEditPage(): React.ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id = '' } = useParams<{ id: string }>();
  const { isAuthenticated, user: currentUser } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const backToList = (): void => void navigate(ROUTES.admin.users);

  const userQuery = useQuery({
    queryKey: ['users', 'detail', id],
    queryFn: () => usersService.getUser(id),
    enabled: isAuthenticated && id !== '',
  });

  const { roles, isError: rolesFailed, error: rolesError } = useRoles();

  /**
   * Finish by going back to the list with the confirmation in tow. It is announced there,
   * not here, because this screen unmounts the moment the save succeeds — a banner rendered
   * on the way out would flash for a frame or never paint at all.
   */
  const invalidateAndLeave = async (notice: string): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    void navigate(ROUTES.admin.users, { state: { notice } });
  };

  const updateMutation = useMutation({
    mutationFn: (patch: UpdateUserDto) => usersService.updateUser(id, patch),
    onSuccess: (_result, patch) =>
      invalidateAndLeave(
        patch.roleId
          ? `${userQuery.data?.fullName ?? 'The account'} updated. Changing the role signed them out of every device.`
          : `${userQuery.data?.fullName ?? 'The account'} updated.`,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersService.deleteUser(id),
    onSuccess: () => invalidateAndLeave(`${userQuery.data?.fullName ?? 'The account'} deleted.`),
    onError: () => setConfirmingDelete(false),
  });

  const user = userQuery.data;

  const handleSubmit = (values: UserFormValues): void => {
    if (!user) return;
    const patch = buildPatch(values, {
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId ?? '',
      instituteId: user.instituteId ?? '',
    });
    // The form's own dirty check already disables the button, so an empty patch here means
    // the values round-tripped to where they started — nothing to send, and nothing to say.
    if (Object.keys(patch).length === 0) {
      backToList();
      return;
    }
    updateMutation.mutate(patch);
  };

  if (userQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <>
        <PageHeader title="Edit User" />
        <Alert tone="danger" className="mb-4">
          {userQuery.isError ? apiErrorMessage(userQuery.error) : 'User not found'}
        </Alert>
        <Button variant="ghost" onClick={backToList}>
          Back to users
        </Button>
      </>
    );
  }

  const isSelf = currentUser?.id === user.id;

  return (
    <>
      <PageHeader title="Edit User" subtitle={user.email} />

      {rolesFailed && (
        <Alert tone="danger" className="mb-4">
          {apiErrorMessage(rolesError)}
        </Alert>
      )}

      <div className="max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <UserForm
          roles={roles}
          instituteOptions={INSTITUTE_OPTIONS}
          initialValues={{
            fullName: user.fullName,
            email: user.email,
            roleId: user.roleId ?? '',
            instituteId: user.instituteId ?? '',
          }}
          onSubmit={handleSubmit}
          onCancel={backToList}
          isSubmitting={updateMutation.isPending}
          submitError={updateMutation.isError ? apiErrorMessage(updateMutation.error) : null}
        />
      </div>

      {/*
        Delete lives here, at the bottom of the edit screen, rather than as a third icon in
        the list row. It is the one action with no way back from the UI — there is no restore
        endpoint — so it should not sit a few pixels from Deactivate, which undoes cleanly.
      */}
      <div className="mt-6 max-w-2xl rounded-lg border border-danger/40 bg-danger-subtle/30 p-6">
        <h2 className="text-sm font-semibold text-foreground">Delete this account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The account disappears from the directory and can never sign in again. Its record is kept
          so the audit trail and anything the user created still make sense, and{' '}
          <strong className="font-medium text-foreground">{user.email}</strong> stays taken — you
          cannot create a new account with that address. To switch someone off temporarily, use
          Deactivate on the users list instead.
        </p>

        {deleteMutation.isError && (
          <Alert
            tone="danger"
            className="mt-3"
            onDismiss={() => deleteMutation.reset()}
            dismissLabel="Dismiss error"
          >
            {apiErrorMessage(deleteMutation.error)}
          </Alert>
        )}

        <Button
          variant="danger"
          className="mt-4"
          disabled={isSelf}
          onClick={() => setConfirmingDelete(true)}
        >
          Delete User
        </Button>
        {isSelf && (
          <p className="mt-2 text-xs text-muted-foreground">You cannot delete your own account.</p>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title={`Delete ${user.fullName}?`}
        description="This cannot be undone from here. They will be signed out of every device immediately, and their email address stays reserved."
        confirmLabel="Delete User"
        tone="danger"
        busy={deleteMutation.isPending}
      />
    </>
  );
}

export default UserEditPage;
