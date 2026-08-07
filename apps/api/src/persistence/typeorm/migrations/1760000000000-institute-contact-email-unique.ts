import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One live institute per contact address.
 *
 * The service checks this before writing, but a pre-check cannot guarantee it: two registrations
 * arriving together both read "free" and both insert. That is not a theoretical race here — the
 * public registration link is open, and the whole point of the check is the moment two people
 * are filling the form at once.
 *
 * **Why a duplicate address is worse than it looks.** An institute's login is created from its
 * contact address at approval. Two institutes sharing one address can only ever have one login
 * between them, so the second is approved into a state with no way in — discovered weeks later,
 * by telephone, with no record of which of them the account belongs to.
 *
 * Scoped exactly like `institutes_code_live_uq`: rejected and deleted rows release their address,
 * which is what lets a turned-away institute apply again with the same one. Wrapped in `lower()`
 * because `contact_email` is plain text, unlike `institute_code` which is citext — without it
 * `Foo@x.pk` and `foo@x.pk` are two rows, and no mail server agrees.
 *
 * Built `concurrently` is not possible inside a migration transaction, and this table is small
 * (roughly 150 rows at full scale), so a plain build is correct here.
 */
export class InstituteContactEmailUnique1760000000000 implements MigrationInterface {
  name = 'InstituteContactEmailUnique1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // An existing database may already hold duplicates — created before anything forbade them.
    // Fail with the addresses named rather than with Postgres's "could not create unique index",
    // which reports one arbitrary value and leaves the operator to hunt for the rest.
    const duplicates = (await queryRunner.query(`
      select lower("contact_email") as contact_email, count(*) as count
      from "institutes"
      where "status" <> 'rejected' and "deleted_at" is null
      group by lower("contact_email")
      having count(*) > 1
      order by 1
    `)) as { contact_email: string; count: string }[];
    if (duplicates.length > 0) {
      const listed = duplicates.map((d) => `${d.contact_email} (${d.count})`).join(', ');
      throw new Error(
        `Cannot enforce one institute per contact address: ${duplicates.length} address(es) ` +
          `are already held by more than one live institute — ${listed}. ` +
          `Resolve these by hand (reject or correct the duplicates), then run the migration again.`,
      );
    }

    await queryRunner.query(`
      create unique index "institutes_contact_email_live_uq"
        on "institutes" (lower("contact_email"))
        where "status" <> 'rejected' and "deleted_at" is null
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists "institutes_contact_email_live_uq"`);
  }
}
