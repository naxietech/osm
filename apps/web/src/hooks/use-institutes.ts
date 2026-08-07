/**
 * React Query wiring for the institutes module. One place that decides the cache keys, so a
 * mutation on one screen cannot forget to invalidate a list another screen is showing.
 */
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type {
  ApproveInstituteDto,
  CreateInstituteDto,
  InstituteDetail,
  PaginatedInstitutes,
  UpdateInstituteDto,
} from '@oses/types';

import {
  type ApprovalResponse,
  type ListInstitutesParams,
  institutesService,
} from '@/services/institutes.service';

/**
 * Every institute query hangs off this prefix, so one `invalidateQueries` after a mutation
 * refreshes the directory, the approval queue and any open detail screen together. Getting that
 * wrong is how an approved institute keeps showing as pending until the cache expires.
 */
export const INSTITUTES_KEY = ['institutes'] as const;

export function useInstitutes(
  params: ListInstitutesParams,
  enabled = true,
): UseQueryResult<PaginatedInstitutes> {
  return useQuery({
    queryKey: [...INSTITUTES_KEY, 'list', params],
    queryFn: () => institutesService.listInstitutes(params),
    enabled,
    // Keeps the previous page on screen while the next one loads, so typing in the search box
    // does not blank the table on every keystroke.
    placeholderData: (previous) => previous,
  });
}

export function useInstitute(id: string, enabled = true): UseQueryResult<InstituteDetail> {
  return useQuery({
    queryKey: [...INSTITUTES_KEY, 'detail', id],
    queryFn: () => institutesService.getInstitute(id),
    enabled: enabled && id !== '',
  });
}

/** Anything that changes an institute invalidates every institute query. */
function useInstituteMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
): UseMutationResult<TResult, unknown, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INSTITUTES_KEY }),
  });
}

export function useCreateInstitute(): UseMutationResult<
  ApprovalResponse,
  unknown,
  CreateInstituteDto
> {
  return useInstituteMutation((dto: CreateInstituteDto) => institutesService.createInstitute(dto));
}

export function useApproveInstitute(): UseMutationResult<
  ApprovalResponse,
  unknown,
  { id: string; dto: ApproveInstituteDto }
> {
  return useInstituteMutation(({ id, dto }) => institutesService.approveInstitute(id, dto));
}

export function useRejectInstitute(): UseMutationResult<
  { message: string },
  unknown,
  { id: string; reason: string }
> {
  return useInstituteMutation(({ id, reason }) => institutesService.rejectInstitute(id, reason));
}

export function useSetInstituteStatus(): UseMutationResult<
  { message: string },
  unknown,
  { id: string; status: 'approved' | 'deactivated' }
> {
  return useInstituteMutation(({ id, status }) => institutesService.setStatus(id, status));
}

export function useUpdateInstitute(): UseMutationResult<
  unknown,
  unknown,
  { id: string; dto: UpdateInstituteDto }
> {
  return useInstituteMutation(({ id, dto }) => institutesService.updateInstitute(id, dto));
}

export function useDeleteInstitute(): UseMutationResult<{ message: string }, unknown, string> {
  return useInstituteMutation((id: string) => institutesService.deleteInstitute(id));
}
