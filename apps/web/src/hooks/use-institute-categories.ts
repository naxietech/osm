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
  UpdateInstituteCategoryDto,
} from '@oses/types';

import { instituteCategoriesService } from '@/services/institute-categories.service';

export const INSTITUTE_CATEGORIES_KEY = ['institute-categories'] as const;

export function useInstituteCategories(enabled = true): UseQueryResult<InstituteCategory[]> {
  return useQuery({
    queryKey: INSTITUTE_CATEGORIES_KEY,
    queryFn: () => instituteCategoriesService.listCategories(),
    enabled,
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
