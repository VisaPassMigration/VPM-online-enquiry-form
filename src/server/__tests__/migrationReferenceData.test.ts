import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDataset: vi.fn(), findDataset: vi.fn(), updateDataset: vi.fn(), createOccupation: vi.fn(), createCost: vi.fn(), audit: vi.fn(),
}));
vi.mock('../audit', () => ({ recordAuditEvent: mocks.audit }));
vi.mock('../db', () => ({ db: { migrationReferenceDataset: { create: mocks.createDataset, findUniqueOrThrow: mocks.findDataset, update: mocks.updateDataset }, occupationReference: { create: mocks.createOccupation }, costReference: { create: mocks.createCost } } }));
import { addCostReference, addOccupationReference, approveMigrationReferenceDataset, archiveMigrationReferenceDataset, createMigrationReferenceDataset, markMigrationReferenceDatasetReviewed, markMigrationReferenceDatasetStale } from '../migrationReferenceData';

const actor = { actorId: 'a1', actorName: 'Admin', actorRole: 'boss_admin' as const, actorStaffUserId: 's1', actorRoles: ['boss_admin'] as const };
const readOnly = { ...actor, actorRole: 'read_only_reviewer' as const, actorRoles: ['read_only_reviewer'] as const };

beforeEach(() => { vi.clearAllMocks(); mocks.createDataset.mockResolvedValue({ id: 'd1', status: 'draft' }); mocks.findDataset.mockResolvedValue({ id: 'd1', status: 'draft' }); mocks.updateDataset.mockResolvedValue({ id: 'd1', status: 'reviewed' }); mocks.createOccupation.mockResolvedValue({ id: 'o1' }); mocks.createCost.mockResolvedValue({ id: 'c1' }); });

describe('migration reference data service', () => {
  it('create dataset writes audit', async () => { await createMigrationReferenceDataset({ actor, datasetVersion: 'v1', reason: 'seed' }); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'migration_reference_dataset_imported' })); });
  it('review action writes audit', async () => { await markMigrationReferenceDatasetReviewed({ actor, datasetId: 'd1', reason: 'reviewed' }); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'migration_reference_dataset_reviewed' })); });
  it('approve action writes audit', async () => { mocks.updateDataset.mockResolvedValue({ id: 'd1', status: 'approved' }); await approveMigrationReferenceDataset({ actor, datasetId: 'd1', reason: 'approved' }); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'migration_reference_dataset_approved' })); });
  it('stale/archive actions work', async () => { mocks.updateDataset.mockResolvedValue({ id: 'd1', status: 'stale' }); await markMigrationReferenceDatasetStale({ actor, datasetId: 'd1', reason: 'stale' }); await archiveMigrationReferenceDataset({ actor, datasetId: 'd1', reason: 'archive' }); expect(mocks.updateDataset).toHaveBeenCalledTimes(2); });
  it('occupation reference can be added', async () => { await addOccupationReference({ actor, datasetId: 'd1', reason: 'add', occupationCode: '111', occupationTitle: 'Dev' }); expect(mocks.createOccupation).toHaveBeenCalled(); });
  it('cost reference can be added', async () => { await addCostReference({ actor, datasetId: 'd1', reason: 'add', category: 'visa', label: 'fee' }); expect(mocks.createCost).toHaveBeenCalled(); });
  it('read_only_reviewer cannot mutate reference data', async () => { await expect(createMigrationReferenceDataset({ actor: readOnly as any, datasetVersion: 'v1', reason: 'x' })).rejects.toThrow('Missing permission'); });
  it('no scraping/live update behavior exists', async () => { const text = (await import('node:fs/promises')).readFile('src/server/migrationReferenceData.ts', 'utf8'); await expect(text).resolves.not.toMatch(/fetch\(|axios|http|https|scrape|cron/i); });
});
