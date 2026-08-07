import { DataSource } from 'typeorm';

import { InstitutionType, Province } from '@oses/types';

import type { ApprovalLogin, CreateInstituteInput } from '../src/modules/institutes/ports';
import { createDataSource } from '../src/persistence/typeorm/data-source';
import {
  InstituteCategoryEntity,
  InstituteCredentialEntity,
  InstituteEntity,
  SessionEntity,
  UserEntity,
} from '../src/persistence/typeorm/entities';
import { TypeOrmUserRepository } from '../src/persistence/typeorm/repositories/auth.repositories';
import { TypeOrmInstituteApprovalRepository } from '../src/persistence/typeorm/repositories/institute-approval.repository';
import { TypeOrmInstituteRepository } from '../src/persistence/typeorm/repositories/institute.repository';
import { seedDatabase } from '../src/persistence/typeorm/seed/seed';
import { SYSTEM_ROLE_IDS } from '../src/rbac/system-roles';
import { resetInstituteData } from './reset-db';
import { requireTestDatabaseUrl } from './test-database';

// Integration test — needs a reachable Postgres. Point DATABASE_URL_TEST (or DATABASE_URL) at
// the oses_test database. Skips cleanly when neither is set.
const TEST_URL = requireTestDatabaseUrl();

const APPLICANT_EMAIL = 'approval-applicant@example.pk';
const STORED_HASH = '$argon2id$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA';

describe('Institute approval (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmInstituteRepository;
  let approvals: TypeOrmInstituteApprovalRepository;
  let categoryId: string;
  let adminId: string;

  const login = (over: Partial<ApprovalLogin> = {}): ApprovalLogin => ({
    email: APPLICANT_EMAIL,
    fullName: 'Ayesha Khan',
    passwordHash: STORED_HASH,
    roleId: SYSTEM_ROLE_IDS.institute,
    ...over,
  });

  const pending = (over: Partial<CreateInstituteInput> = {}): CreateInstituteInput => ({
    instituteCode: 'S01',
    instituteName: 'Government High School',
    branch: null,
    categoryId,
    institutionType: InstitutionType.GOVERNMENT,
    address: '1 Mall Road',
    city: 'Lahore',
    province: Province.PUNJAB,
    postalCode: null,
    contactPersonName: 'Ayesha Khan',
    contactPersonDesignation: 'Principal',
    contactEmail: APPLICANT_EMAIL,
    contactPhone: '+92-42-1234567',
    answers: [],
    status: 'pending',
    registrationSource: 'public',
    passwordHash: STORED_HASH,
    actorId: null,
    ...over,
  });

  /** Everything the approval transaction is supposed to have written, read back from the DB. */
  async function snapshot(instituteId: string) {
    const institute = await dataSource
      .getRepository(InstituteEntity)
      .findOne({ where: { id: instituteId } });
    const credentials = await dataSource
      .getRepository(InstituteCredentialEntity)
      .count({ where: { instituteId } });
    const users = await dataSource.getRepository(UserEntity).count({ where: { instituteId } });
    return {
      status: institute?.status,
      numericCode: institute?.numericCode,
      credentials,
      users,
    };
  }

  beforeAll(async () => {
    dataSource = createDataSource(TEST_URL);
    await dataSource.initialize();
    await dataSource.runMigrations();
    await seedDatabase(dataSource, {
      superAdmin: {
        email: 'approval-super@oses.pk',
        password: 'approval-super-password',
        fullName: 'Approval Super',
      },
    });
    const admin = await dataSource
      .getRepository(UserEntity)
      .findOneOrFail({ where: { email: 'approval-super@oses.pk' } });
    adminId = admin.id;

    repo = new TypeOrmInstituteRepository(dataSource.getRepository(InstituteEntity), dataSource);
    approvals = new TypeOrmInstituteApprovalRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('delete from users where email like $1', ['%@example.pk']);
    await resetInstituteData(dataSource);
    const category = await dataSource
      .getRepository(InstituteCategoryEntity)
      .save({ code: 'SCH', name: 'School', description: null });
    categoryId = category.id;
  });

  describe('the happy path', () => {
    it('flips the status, draws a code, creates the user and destroys the credential', async () => {
      const institute = await repo.create(pending());
      const result = await approvals.approve({
        instituteId: institute.id,
        approvedBy: adminId,
        login: login(),
      });

      expect(result.outcome).toBe('approved');
      await expect(snapshot(institute.id)).resolves.toEqual({
        status: 'approved',
        numericCode: expect.any(Number),
        credentials: 0,
        users: 1,
      });
    });

    it('gives the new account the institute role and links it to the institute', async () => {
      const institute = await repo.create(pending());
      await approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: login() });

      const user = await dataSource
        .getRepository(UserEntity)
        .findOneOrFail({ where: { email: APPLICANT_EMAIL } });
      expect(user.roleId).toBe(SYSTEM_ROLE_IDS.institute);
      expect(user.instituteId).toBe(institute.id);
      expect(user.status).toBe('active');
    });

    /**
     * The user directory shows which institute an account belongs to, and it must come from the
     * API. The web app used to resolve the id against its own institute mock, which held none of
     * these ids, so the column was blank for every institute account ever created.
     *
     * Asserted through the repository the directory actually uses, because the join is the part
     * that can break — and did: with a join present, TypeORM's `take`/`skip` needs entity
     * metadata for the joined alias and throws on a bare table name.
     */
    it('carries the institute name on the user directory listing', async () => {
      const institute = await repo.create(pending());
      await approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: login() });

      const users = new TypeOrmUserRepository(dataSource.getRepository(UserEntity));
      const page = await users.list({ limit: 25, offset: 0 });

      const account = page.find((u) => u.email === APPLICANT_EMAIL);
      expect(account?.instituteName).toBe(institute.instituteName);
      // A global account has no institute, and must read as null rather than as a stray name.
      expect(page.find((u) => u.instituteId === null)?.instituteName ?? null).toBeNull();
    });

    it('approves without a login when none is asked for, and still destroys the credential', async () => {
      const institute = await repo.create(pending());
      const result = await approvals.approve({
        instituteId: institute.id,
        approvedBy: adminId,
        login: null,
      });

      expect(result.outcome).toBe('approved');
      await expect(snapshot(institute.id)).resolves.toMatchObject({
        status: 'approved',
        credentials: 0,
        users: 0,
      });
    });
  });

  describe('a failure inside the transaction', () => {
    it('leaves the database exactly as it was when the user insert fails', async () => {
      // The realistic failure: the email was taken between the service's pre-check and here.
      // Everything before it — the status flip, the numeric code — must come back.
      const institute = await repo.create(pending());
      await dataSource.getRepository(UserEntity).insert({
        email: APPLICANT_EMAIL,
        passwordHash: STORED_HASH,
        roleId: SYSTEM_ROLE_IDS.institute,
        fullName: 'Existing Holder',
        status: 'active',
      });

      const before = await snapshot(institute.id);
      const result = await approvals.approve({
        instituteId: institute.id,
        approvedBy: adminId,
        login: login(),
      });

      expect(result.outcome).toBe('email-taken');
      const after = await snapshot(institute.id);
      expect(after.status).toBe('pending');
      expect(after.numericCode).toBeNull();
      // The credential survives, so the approval can simply be retried once the clash is resolved.
      expect(after.credentials).toBe(1);
      expect(before.credentials).toBe(1);
    });

    it('leaves no half-approved institute behind when the role does not exist', async () => {
      const institute = await repo.create(pending());
      const result = approvals.approve({
        instituteId: institute.id,
        approvedBy: adminId,
        login: login({ roleId: '00000000-0000-4000-8000-000000000000' }),
      });

      await expect(result).rejects.toThrow();
      await expect(snapshot(institute.id)).resolves.toMatchObject({
        status: 'pending',
        numericCode: null,
        credentials: 1,
        users: 0,
      });
    });
  });

  describe('approving twice', () => {
    it('creates exactly one account when two approvals race', async () => {
      const institute = await repo.create(pending());

      const [first, second] = await Promise.all([
        approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: login() }),
        approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: login() }),
      ]);

      const outcomes = [first.outcome, second.outcome].sort();
      expect(outcomes).toEqual(['approved', 'not-pending'].sort());
      await expect(snapshot(institute.id)).resolves.toMatchObject({ users: 1 });
    });

    it('reports not-pending on a second sequential approval', async () => {
      const institute = await repo.create(pending());
      await approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: login() });

      const again = await approvals.approve({
        instituteId: institute.id,
        approvedBy: adminId,
        login: login({ email: 'second@example.pk' }),
      });
      expect(again.outcome).toBe('not-pending');
      await expect(snapshot(institute.id)).resolves.toMatchObject({ users: 1 });
    });
  });

  describe('reject', () => {
    it('records the reason, destroys the credential and frees the code', async () => {
      const institute = await repo.create(pending());
      const result = await approvals.reject({
        instituteId: institute.id,
        reason: 'Could not verify the government code',
        rejectedBy: adminId,
      });

      expect(result.outcome).toBe('rejected');
      await expect(snapshot(institute.id)).resolves.toMatchObject({
        status: 'rejected',
        credentials: 0,
      });
      await expect(repo.isCodeTaken('S01')).resolves.toBe(false);
    });

    it('lets the institute apply again with the same code', async () => {
      const first = await repo.create(pending());
      await approvals.reject({ instituteId: first.id, reason: 'Typo', rejectedBy: adminId });

      await expect(repo.create(pending())).resolves.toMatchObject({ status: 'pending' });
    });

    it('refuses to reject an institute that is already approved', async () => {
      const institute = await repo.create(pending());
      await approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: null });

      const result = await approvals.reject({
        instituteId: institute.id,
        reason: 'Too late',
        rejectedBy: adminId,
      });
      expect(result.outcome).toBe('not-pending');
    });
  });

  describe('deactivation', () => {
    it('revokes every open session so an institute cannot renew its way back in', async () => {
      const institute = await repo.create(pending());
      await approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: login() });
      const user = await dataSource
        .getRepository(UserEntity)
        .findOneOrFail({ where: { email: APPLICANT_EMAIL } });

      await dataSource.getRepository(SessionEntity).insert({
        userId: user.id,
        refreshHash: 'hash',
        familyId: '11111111-1111-4111-8111-111111111111',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await approvals.setStatus(institute.id, 'deactivated', adminId);

      const live = await dataSource
        .getRepository(SessionEntity)
        .count({ where: { userId: user.id, revokedAt: undefined } });
      const revoked = await dataSource
        .getRepository(SessionEntity)
        .findOneOrFail({ where: { userId: user.id } });
      expect(revoked.revokedAt).not.toBeNull();
      expect(revoked.revokedReason).toBe('institute_deactivated');
      void live;
    });

    it('reactivates without touching sessions', async () => {
      const institute = await repo.create(pending());
      await approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: null });
      await approvals.setStatus(institute.id, 'deactivated', adminId);

      const back = await approvals.setStatus(institute.id, 'approved', adminId);
      expect(back?.status).toBe('approved');
    });

    it('refuses to deactivate an institute still awaiting approval', async () => {
      // A pending row has no numeric code, and the check constraint would reject the update.
      // Guarding in the query turns that into a clean null instead of a 500.
      const institute = await repo.create(pending());
      await expect(approvals.setStatus(institute.id, 'deactivated', adminId)).resolves.toBeNull();
    });

    it('keeps the numeric code across deactivation, so it can never be reissued', async () => {
      const institute = await repo.create(pending());
      await approvals.approve({ instituteId: institute.id, approvedBy: adminId, login: null });
      const approved = await snapshot(institute.id);

      await approvals.setStatus(institute.id, 'deactivated', adminId);
      await expect(snapshot(institute.id)).resolves.toMatchObject({
        numericCode: approved.numericCode,
      });
    });
  });
});
