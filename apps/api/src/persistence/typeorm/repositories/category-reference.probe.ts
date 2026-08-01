import { Injectable } from '@nestjs/common';

import type { CategoryReferenceProbe } from '../../../modules/institute-categories/ports';

/**
 * Placeholder {@link CategoryReferenceProbe} for the period before institute registration
 * (Module 2) exists. Nothing can reference a category or answer a question yet, so it truthfully
 * reports "no references".
 *
 * The rules that consume it — retire-instead-of-delete, and the blocked changes on answered
 * questions — are already written and tested. When Module 2 lands, replacing this one class with
 * a querying implementation switches those protections on; no rule has to be retrofitted onto a
 * table that is already live.
 */
@Injectable()
export class NoCategoryReferencesProbe implements CategoryReferenceProbe {
  private static readonly EMPTY: ReadonlySet<string> = new Set<string>();

  questionsWithAnswers(): Promise<ReadonlySet<string>> {
    return Promise.resolve(NoCategoryReferencesProbe.EMPTY);
  }

  isCategoryInUse(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
