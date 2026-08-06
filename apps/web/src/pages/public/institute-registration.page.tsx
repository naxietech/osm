/**
 * Public Institute Registration (open link, no authentication).
 *
 * Submitting creates one pending application and nothing else — no login, no access — until a
 * super admin approves it. That is what makes an anonymous write route acceptable at all.
 *
 * Three things here are deliberate rather than incidental:
 *
 * - **Progress is kept in the browser.** The form is long, and losing it to an accidental
 *   refresh is the worst thing that can happen to an applicant. Saving drafts on the server
 *   would need a table, an expiry policy and a resume token that is itself a small credential —
 *   all to solve something `sessionStorage` already solves. See `usePersistedState`.
 * - **The code and email are checked before the long part.** With no email service, an applicant
 *   who clashes would otherwise find out days later, by phone, that the whole thing was never
 *   viable. The check is one request at the step boundary, not on every keystroke.
 * - **The confirmation names the institute code.** There is no reference number to invent: the
 *   code is unique, they typed it themselves, and it is what they will quote when they ring up.
 */
import React, { useMemo, useState } from 'react';

import type { InstituteCategory, RegisterInstituteDto, RegistrationReceipt } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Building2, Check } from '@/design-system/atoms/icon';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { FormField } from '@/design-system/molecules/form-field';
import { InstituteRegistrationForm } from '@/design-system/organisms/institute-registration-form';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { apiErrorMessage } from '@/services/api-client';
import { publicInstitutesService } from '@/services/institutes.service';

/** Namespaced and versioned: a value stored by an older form must not be read back into a new one. */
const DRAFT_KEY = 'oses.institute-registration.v1';

interface Gate {
  instituteCode: string;
  contactEmail: string;
}

export function InstituteRegistrationPage(): React.ReactElement {
  const [categories, setCategories] = useState<InstituteCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [gate, setGate, clearGate] = usePersistedState<Gate>(DRAFT_KEY, {
    instituteCode: '',
    contactEmail: '',
  });
  const [gatePassed, setGatePassed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    publicInstitutesService
      .listPublicCategories()
      .then(setCategories)
      .catch((err: unknown) => setLoadError(apiErrorMessage(err)));
  }, []);

  const activeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.isActive),
    [categories],
  );

  /**
   * The step boundary. Both fields are checked in one request, and the answer is shown here
   * rather than at the end of the form.
   *
   * This does confirm to an anonymous caller that a code or address exists, which is normally
   * avoided. It was accepted deliberately: these are institutions rather than individuals, there
   * are roughly 150 of them, the route is rate limited, and without it there is no way to tell an
   * applicant anything at all.
   */
  const checkAndContinue = async (): Promise<void> => {
    setGateError(null);
    setChecking(true);
    try {
      const result = await publicInstitutesService.checkAvailability({
        instituteCode: gate.instituteCode.trim(),
        contactEmail: gate.contactEmail.trim(),
      });
      if (result.codeAvailable === false) {
        setGateError('An institute is already registered with that code.');
        return;
      }
      if (result.emailAvailable === false) {
        setGateError('That email address already has an account. Use a different one.');
        return;
      }
      setGatePassed(true);
    } catch (err) {
      setGateError(apiErrorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = (dto: RegisterInstituteDto): void => {
    setSubmitError(null);
    setSubmitting(true);
    publicInstitutesService
      .registerInstitute(dto)
      .then((result) => {
        // The draft has served its purpose, and it holds a password. Nothing keeps it now.
        clearGate();
        setReceipt(result);
      })
      .catch((err: unknown) => setSubmitError(apiErrorMessage(err)))
      .finally(() => setSubmitting(false));
  };

  if (receipt) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
          <Check className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold text-foreground">Registration received</h1>
        <p className="text-sm text-muted-foreground">
          We have your application for{' '}
          <span className="font-medium text-foreground">{receipt.instituteName}</span>, institute
          code{' '}
          <span className="font-mono font-medium text-foreground">{receipt.instituteCode}</span>.
        </p>
        <p className="text-sm text-muted-foreground">
          The board will check it and get in touch. <strong>Quote your institute code</strong> if
          you need to ask about it — that is how your application is found. Once it is approved you
          can sign in with the email and password you just chose.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
          <Building2 className="h-7 w-7" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Institute Registration</h1>
          <p className="text-sm text-muted-foreground">
            Register your institute. The board will review and approve your request.
          </p>
        </div>
      </div>

      {loadError && (
        <Alert tone="danger" className="mb-4">
          {loadError}
        </Alert>
      )}

      {!gatePassed ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-base font-semibold text-foreground">
            Let&rsquo;s start with two things
          </h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            We check these first so you do not fill in the whole form only to find one is already
            taken.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="gate-institute-code"
              name="instituteCode"
              label="Institute Code"
              value={gate.instituteCode}
              onChange={(e) => setGate((g) => ({ ...g, instituteCode: e.target.value }))}
              required
            />
            <FormField
              id="gate-contact-email"
              name="contactEmail"
              type="email"
              label="Contact Email"
              value={gate.contactEmail}
              onChange={(e) => setGate((g) => ({ ...g, contactEmail: e.target.value }))}
              required
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The code your government or board issued you. The email becomes your sign-in address
            once the registration is approved.
          </p>

          {gateError && (
            <Alert tone="danger" className="mt-4" onDismiss={() => setGateError(null)}>
              {gateError}
            </Alert>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              isLoading={checking}
              disabled={!gate.instituteCode.trim() || !gate.contactEmail.trim()}
              onClick={() => void checkAndContinue()}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : categories === null ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-foreground">
              Registering <span className="font-mono font-medium">{gate.instituteCode}</span> ·{' '}
              {gate.contactEmail}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setGatePassed(false)}>
              Change
            </Button>
          </div>

          {submitError && (
            <Alert tone="danger" className="mb-4" onDismiss={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}

          <InstituteRegistrationForm
            categories={activeCategories}
            initialCode={gate.instituteCode.trim()}
            initialEmail={gate.contactEmail.trim()}
            isSubmitting={submitting}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  );
}

export default InstituteRegistrationPage;
