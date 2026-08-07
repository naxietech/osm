/**
 * React Query wiring for institute categories.
 *
 * Every mutation invalidates the whole group, which matters more here than elsewhere: after a
 * save the screen must re-read the category to pick up its **new `version`**. Showing a stale one
 * would make the very next save fail with a conflict the editor did nothing to cause.
 */
import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type {
  CreateInstituteCategoryDto,
  InstituteCategory,
  PublicInstituteCategory,
  UpdateInstituteCategoryDto,
} from '@oses/types';

import { instituteCategoriesService } from '@/services/institute-categories.service';
import { publicInstitutesService } from '@/services/institutes.service';

export const INSTITUTE_CATEGORIES_KEY = ['institute-categories'] as const;

/**
 * Deliberately a different key from the admin list above. The public route returns only what an
 * anonymous applicant may see, so sharing one cache entry would let whichever screen loaded first
 * decide what the other one shows — including, in the wrong order, showing the trimmed public
 * shape on the admin screen.
 */
export const PUBLIC_INSTITUTE_CATEGORIES_KEY = ['public', 'institute-categories'] as const;

export function useInstituteCategories(enabled = true): UseQueryResult<InstituteCategory[]> {
  return useQuery({
    queryKey: INSTITUTE_CATEGORIES_KEY,
    queryFn: () => instituteCategoriesService.listCategories(),
    enabled,
  });
}

/**
 * The categories offered on the open registration link. No credentials are sent, so there is no
 * session to go stale — the list changes about as often as the taxonomy itself, and re-fetching
 * it on every window focus would be a request an anonymous visitor never asked for.
 */
export function usePublicInstituteCategories(): UseQueryResult<PublicInstituteCategory[]> {
  return useQuery({
    queryKey: PUBLIC_INSTITUTE_CATEGORIES_KEY,
    queryFn: () => publicInstitutesService.listPublicCategories(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

function useCategoryMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
): UseMutationResult<TResult, unknown, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INSTITUTE_CATEGORIES_KEY }),
  });
}

export function useCreateCategory(): UseMutationResult<
  InstituteCategory,
  unknown,
  CreateInstituteCategoryDto
> {
  return useCategoryMutation((dto: CreateInstituteCategoryDto) =>
    instituteCategoriesService.createCategory(dto),
  );
}

export function useUpdateCategory(): UseMutationResult<
  InstituteCategory,
  unknown,
  { id: string; dto: UpdateInstituteCategoryDto }
> {
  return useCategoryMutation(({ id, dto }) => instituteCategoriesService.updateCategory(id, dto));
}

export function useSetCategoryActive(): UseMutationResult<
  InstituteCategory,
  unknown,
  { id: string; isActive: boolean }
> {
  return useCategoryMutation(({ id, isActive }) =>
    instituteCategoriesService.setActive(id, isActive),
  );
}

export function useDeleteCategory(): UseMutationResult<{ message: string }, unknown, string> {
  return useCategoryMutation((id: string) => instituteCategoriesService.deleteCategory(id));
}
