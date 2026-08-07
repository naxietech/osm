/**
 * Pending Institutes (super admin) — the queue of registrations awaiting review.
 *
 * **No decision is taken here.** The only action is View, which opens the detail screen where
 * Approve & Register and Reject live behind confirmations. Approving creates a login and draws a
 * permanent institute number that is never reissued; that is not an action to leave one careless
 * click away in a list, and the detail screen is where the government code, the contact number
 * and the duplicate warning are all in front of you to check first.
 *
 * A table rather than cards, matching every other list in the app — and search, a category
 * filter and pagination for the same reason the directory has them. Pagination is not really
 * about volume: this screen previously asked for `limit: 100` and rendered whatever came back,
 * so a registration drive that pushed the queue past a hundred would have silently hidden the
 * rest with nothing on screen to say so.
 *
 * Gated by `institutes.view`; the View action needs nothing more, since the detail screen gates
 * the decisions themselves.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { Institute } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Eye } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { FilterBar } from '@/design-system/molecules/filter-bar';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInstituteCategories } from '@/hooks/use-institute-categories';
import { useInstitutes } from '@/hooks/use-institutes';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { INSTITUTES_PAGE_SIZE } from '@/services/institutes.service';

/** How long an application has been waiting, in the roughest useful unit. */
function waitingFor(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function InstituteApprovalsPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const categoryId = searchParams.get('category') ?? '';
  const page = Math.max(0, Number(searchParams.get('page') ?? '1') - 1);

  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebouncedValue(searchInput);

  const categoriesQuery = useInstituteCategories();
  const categories = categoriesQuery.data ?? [];

  /** Writes the params, always resetting to page one — narrowing a list invalidates its offset. */
  const narrow = (next: Record<string, string>): void => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (debouncedSearch !== q) narrow({ q: debouncedSearch });
    // Only the debounced value drives this; including `narrow`/`q` would re-run it on every
    // render and fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const pendingQuery = useInstitutes({
    status: 'pending',
    limit: INSTITUTES_PAGE_SIZE,
    offset: page * INSTITUTES_PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(categoryId ? { categoryId } : {}),
  });

  const pending = pendingQuery.data?.items ?? [];
  const total = pendingQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / INSTITUTES_PAGE_SIZE));
  const firstShown = total === 0 ? 0 : page * INSTITUTES_PAGE_SIZE + 1;
  const lastShown = Math.min(total, (page + 1) * INSTITUTES_PAGE_SIZE);
  const isNarrowed = q.trim().length > 0 || categoryId !== '';

  const goToPage = (oneBased: number): void => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(oneBased));
    setSearchParams(params, { replace: true });
  };

  const categoryName = (id: string): string =>
    categories.find((c) => c.id === id)?.name ?? 'Unknown category';

  const columns: ColumnDef<Institute>[] = [
    {
      key: 'instituteName',
      header: 'Institute',
      render: (row) => (
        <div>
          <span className="font-medium text-foreground">{row.instituteName}</span>
          {row.branch && <span className="text-muted-foreground"> · {row.branch}</span>}
          <p className="text-xs text-muted-foreground">
            {row.contactPersonName} ({row.contactPersonDesignation}) · {row.contactPhone}
          </p>
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
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-sm">{categoryName(row.categoryId)}</span>,
      width: '150px',
    },
    { key: 'city', header: 'City', render: (row) => row.city, width: '130px' },
    {
      key: 'applied',
      header: 'Applied',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{waitingFor(row.createdAt)}</span>
      ),
      width: '120px',
    },
    {
      key: 'actions',
      header: 'Actions',
      // View only. Approve and Reject are on the detail screen on purpose — see the file header.
      render: (row) => (
        <div className="flex justify-end">
          <IconButton
            size="sm"
            label={`View ${row.instituteName}`}
            icon={<Eye className="h-4 w-4" aria-hidden />}
            onClick={(e) => {
              e.stopPropagation();
              void navigate(`${ROUTES.admin.institutes}/${row.id}`);
            }}
          />
        </div>
      ),
      width: '100px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Pending Institutes"
        subtitle="Registrations waiting to be checked and approved"
      />

      {pendingQuery.isError && (
        <Alert tone="danger" className="mb-4">
          {apiErrorMessage(pendingQuery.error)}
        </Alert>
      )}

      <FilterBar
        className="mb-4"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchLabel="Search pending institutes"
        searchPlaceholder="Search by name, code or city"
        filters={[
          {
            id: 'category',
            label: 'Category',
            value: categoryId,
            onChange: (value) => narrow({ category: value }),
            options: categories.map((c) => ({ value: c.id, label: c.name })),
            allLabel: 'All categories',
          },
        ]}
        onClear={() => {
          setSearchInput('');
          narrow({ q: '', category: '' });
        }}
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {pendingQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <DataTable<Institute>
            data={pending}
            columns={columns}
            onRowClick={(row) => void navigate(`${ROUTES.admin.institutes}/${row.id}`)}
            emptyMessage={
              isNarrowed
                ? 'No pending registrations match those filters'
                : 'Nothing waiting. New registrations from the public link appear here.'
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
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => goToPage(page)}>
              Previous
            </Button>
            <span>
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => goToPage(page + 2)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default InstituteApprovalsPage;
