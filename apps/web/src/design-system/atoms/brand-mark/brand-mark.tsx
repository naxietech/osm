import { type ComponentProps } from 'react';

import { GraduationCap } from '@/design-system/atoms/icon';

export type BrandMarkProps = Omit<ComponentProps<typeof GraduationCap>, 'ref'>;

/**
 * The OSES logo mark (graduation cap), used in the brand lockup and as the login
 * watermark.
 *
 * Kept as its own atom rather than calling {@link GraduationCap} at each site: the
 * mark is a *brand asset*, not an icon chosen for meaning, so when the logo changes
 * only this file changes — call sites keep saying "brand mark". Always decorative;
 * the lockup's "OSES" wordmark carries the accessible name.
 */
export function BrandMark(props: BrandMarkProps): React.ReactElement {
  return <GraduationCap aria-hidden {...props} />;
}

export default BrandMark;
