# Atomic Design — Layer Boundaries (enforced)

The `apps/web` frontend follows Atomic Design. Layer boundaries are **enforced by ESLint**
(`no-restricted-imports` overrides in `apps/web/.eslintrc.cjs`, one per layer, matched on the
`@/` import specifier). A violation fails `pnpm lint` — it is not a style suggestion.

## Layers

| Layer     | Directory                      | Purpose                                                                                |
| --------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Atoms     | `src/design-system/atoms/`     | Single-purpose, zero business logic (`Button`, `Input`, `Badge`, `Kbd`, `Textarea`)    |
| Molecules | `src/design-system/molecules/` | Atom compositions with minor logic (`FormField`, `StatusBadge`, `MarkingBandSelector`) |
| Organisms | `src/design-system/organisms/` | Domain-aware compositions (`InstituteForm`, `DataTable`, `MarkingWorkspace`)           |
| Templates | `src/design-system/templates/` | Page-structure shells (`PageLayout`, `AuthLayout`)                                     |

## Import rules

- **Atoms** must not import molecules, organisms, or templates.
- **Molecules** must not import organisms or templates.
- **Organisms** may import atoms and molecules only — **including no other organism**.
- **Templates** may import atoms, molecules, and organisms.
- **Pages** may import any design-system layer.
- **No design-system file may import `@/pages`, `@/services`, or `@/router`.** The design
  system stays presentational: it takes data + predicates as props and emits values through
  callbacks. The page owns the service calls and passes results down.

Imports inside one component folder are relative (`./x`) and stay legal — the boundary is only
on the `@/design-system/<layer>` alias.

## Reuse before building (hard habit)

Before adding any UI primitive, **inventory the design system first**. Then, in order:

1. Reuse an existing atom/molecule/organism.
2. If it doesn't exist, build it into the **correct layer** with its own folder + `index.ts`
   barrel + `.test.tsx`.
3. **Never** inline a new primitive directly in a page or hand-roll a one-off (a raw
   `<button>`, a bespoke checkbox, an inline SVG). If you catch a repeated inline pattern,
   extract it to the right layer.

A single-use block that is genuinely page-specific (a one-off card, a flag box) can stay in the
page — don't over-extract. The line: is it a reusable primitive, or page-specific composition?

## Keep pages thin

A page is a list/detail plus service wiring. Any form, builder, or workspace with real logic
belongs in `design-system/organisms/<name>/`. Reference: `organisms/institute-form` for the
pattern, `pages/setup/subjects.page.tsx` for how small a page should stay. Pages must not
export shared helpers for other pages to import — extract those to a molecule or `lib/`.
