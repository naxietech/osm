# TypeScript Conventions

## Naming

| Target                | Convention                          | Example                                            |
| --------------------- | ----------------------------------- | -------------------------------------------------- |
| Files                 | kebab-case                          | `institutes-list.page.tsx`, `institute.service.ts` |
| React components      | PascalCase                          | `InstitutesListPage`, `DataTable`                  |
| Functions & variables | camelCase                           | `createInstitute`, `isLoading`                     |
| Constants             | UPPER_SNAKE_CASE                    | `MAX_FILE_SIZE`, `BAND_ORDER`                      |
| Types / interfaces    | PascalCase, **no `I` prefix**       | `Institute`, not `IInstitute`                      |
| Enums                 | PascalCase enum, UPPER_SNAKE values | `UserRole.ADMIN`                                   |
| Folders               | kebab-case                          | `design-system/`, `exam-cycles/`                   |
| Test files            | same name + `.test.ts(x)`           | `button.test.tsx`                                  |
| Barrels               | `index.ts` in every folder          | `atoms/button/index.ts`                            |

## Strictness

- `noUncheckedIndexedAccess` is **ON**. Indexing an array/record yields `T | undefined` — handle
  it (guard, default, or `?.`). Do not silence it with `!` unless the access is provably safe and
  you say why.
- **No `any`.** Use `unknown` + narrowing, generics, or a real type. No `@ts-ignore`/`@ts-expect-error`
  without a one-line reason comment.
- Prefer `type` aliases for unions/props; `interface` is fine for object shapes — match the file's
  existing style.

## `@oses/types` is the single source of truth

- Both `apps/web` and `apps/api` import shared shapes from `@oses/types`. **Never redefine a type
  that already exists there** — import it.
- `@oses/types` has **zero third-party dependencies**. Keep it that way. It is almost type-only;
  the enums and a few helpers (e.g. `questionTypeHasOptions()`) emit runtime JS and are imported as
  values.
- A new shared shape (used by both web and api, or by multiple modules) goes in `@oses/types`, not
  in one app.

## Barrels

Every folder has an `index.ts` that re-exports its public surface. Import from the folder barrel
(`@/design-system/atoms`), not deep paths. Keep barrels complete — a missing export is a bug.
