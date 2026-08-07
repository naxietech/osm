/**
 * Institutes (super admin) — the directory, live against the API.
 *
 * Search, filters and page live in the URL rather than in state, so the back button works, a
 * refresh keeps your place, and a narrowed list can be sent to someone as a link. The same
 * shape the users directory uses.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { INSTITUTE_STATUSES, type Institute, type InstituteStatus } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Eye, Pencil } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { FilterBar } from '@/design-system/molecules/filter-bar';
import { StatusBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { usePermissions } from '@/hooks';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInstitutes } from '@/hooks/use-institutes';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { INSTITUTES_PAGE_SIZE } from '@/services/institutes.service';

const STATUS_LABELS: Record<InstituteStatus, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  deactivated: 'Deactivated',
};

/** Only a value the API will accept becomes a filter — anything else is treated as no filter. */
function readStatus(raw: string | null): InstituteStatus | undefined {
  return INSTITUTE_STATUSES.find((s) => s === raw);
}

export function InstitutesListPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const status = readStatus(searchParams.get('status'));
  const page = Math.max(0, Number(searchParams.get('page') ?? '1') - 1);

  /** The box renders this immediately; only the debounced copy reaches the URL and the query. */
  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebouncedValue(searchInput);

  /** A confirmation handed over by the detail screen, which unmounts before it could show one. */
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );

  useEffect(() => {
    // Consume it, so a refresh or a Back does not replay a message about something already done.
    if (location.state) window.history.replaceState({}, '');
  }, [location.state]);

  const applyParams = (changes: Record<string, string>, replace = false): void =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace },
    );

  /**
   * Any change to what is being matched sends you back to page 1. Staying put would ask for
   * rows 51–75 of a result set that may now hold three, and an empty page reads as a bug.
   */
  const narrow = (changes: Record<string, string>, replace = false): void =>
    applyParams({ ...changes, page: '' }, replace);

  useEffect(() => {
    if (debouncedSearch !== q) narrow({ q: debouncedSearch }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `narrow` is stable in practice and
    // adding it would re-run this on every render.
  }, [debouncedSearch]);

  const institutesQuery = useInstitutes({
    q,
    ...(status ? { status } : {}),
    limit: INSTITUTES_PAGE_SIZE,
    offset: page * INSTITUTES_PAGE_SIZE,
  });

  const rows = institutesQuery.data?.items ?? [];
  const total = institutesQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / INSTITUTES_PAGE_SIZE));
  const firstShown = total === 0 ? 0 : page * INSTITUTES_PAGE_SIZE + 1;
  const lastShown = Math.min((page + 1) * INSTITUTES_PAGE_SIZE, total);
  const isNarrowed = q.trim().length > 0 || status !== undefined;
  const listError = institutesQuery.isError ? apiErrorMessage(institutesQuery.error) : null;

  /** An Admin holds `institutes.view` only — they may look, not edit. */
  const { can } = usePermissions();
  const canManage = can('institutes.manage');

  const columns: ColumnDef<Institute>[] = [
    {
      key: 'instituteName',
      header: 'Institute',
      render: (row) => (
        <div>
          <span className="font-medium">{row.instituteName}</span>
          {row.branch && <span className="text-muted-foreground"> · {row.branch}</span>}
        </div>
      ),
    },
    {
      key: 'instituteCode',
      header: 'Code',
      render: (row) => (
        <span className="font-mono text-sm text-muted-foreground">{row.instituteCode}</span>
      ),
      width: '130px',
    },
    { key: 'city', header: 'City', render: (row) => row.city, width: '140px' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
      width: '150px',
    },
    {
      key: 'actions',
      header: 'Actions',
      /**
       * Icon buttons, the same pattern as the institute-categories table. Each carries the
       * institute's name in its label, so a screen reader hears which row it belongs to rather
       * than the fifth identical "Edit" on the page.
       *
       * The pair here is deliberately narrow. Deactivating, approving and deleting all need
       * confirmation and context that only the detail screen has — offering them a click away
       * from a list of forty rows is how the wrong institute gets switched off.
       */
      render: (row) => {
        const open = (e: React.MouseEvent): void => {
          e.stopPropagation();
          void navigate(`${ROUTES.admin.institutes}/${row.id}`);
        };
        return (
          <div className="flex justify-end gap-2">
            <IconButton
              size="sm"
              label={`View ${row.instituteName}`}
              icon={<Eye className="h-4 w-4" aria-hidden />}
              onClick={open}
            />
            {canManage && (
              <IconButton
                size="sm"
                label={`Edit ${row.instituteName}`}
                icon={<Pencil className="h-4 w-4" aria-hidden />}
                onClick={open}
              />
            )}
          </div>
        );
      },
      width: '120px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Institutes"
        subtitle="Registrations, approvals and the institute directory"
        actions={
          <Button variant="primary" onClick={() => void navigate(ROUTES.admin.institutesAdd)}>
            Add Institute
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {listError && (
        <Alert tone="danger" className="mb-4">
          {listError}
        </Alert>
      )}

      <FilterBar
        className="mb-4"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchLabel="Search institutes"
        searchPlaceholder="Search by name, code or city"
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: status ?? '',
            onChange: (value) => narrow({ status: value }),
            options: INSTITUTE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            allLabel: 'All statuses',
          },
        ]}
        onClear={() => {
          setSearchInput('');
          narrow({ q: '', status: '' });
        }}
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {institutesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <DataTable<Institute>
            data={rows}
            columns={columns}
            onRowClick={(row) => void navigate(`${ROUTES.admin.institutes}/${row.id}`)}
            emptyMessage={
              isNarrowed ? 'No institutes match those filters' : 'No institutes registered yet'
            }
          />
        )}
      </div>

      {total > INSTITUTES_PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {firstShown}–{lastShown} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => applyParams({ page: String(page) })}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => applyParams({ page: String(page + 2) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default InstitutesListPage;
