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
  it('create dataset writes imported audit with reason and entity linkage', async () => { await createMigrationReferenceDataset({ actor, datasetVersion: 'v1', reason: 'seed' }); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'migration_reference_dataset_imported', internalNote: 'seed', reason: 'seed', relatedEntityType: 'migration_reference_dataset', relatedEntityId: 'd1', fromValue: null, toValue: 'draft' })); });
  it('review action writes audit with from/to values', async () => { await markMigrationReferenceDatasetReviewed({ actor, datasetId: 'd1', reason: 'reviewed' }); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'migration_reference_dataset_reviewed', internalNote: 'reviewed', reason: 'reviewed', fromValue: 'draft', toValue: 'reviewed' })); });
  it('approve action writes audit and preserves approved event type', async () => { mocks.updateDataset.mockResolvedValue({ id: 'd1', status: 'approved' }); await approveMigrationReferenceDataset({ actor, datasetId: 'd1', reason: 'approved' }); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'migration_reference_dataset_approved', fromValue: 'draft', toValue: 'approved' })); });
  it('stale and archive actions produce distinct events', async () => { mocks.updateDataset.mockResolvedValueOnce({ id: 'd1', status: 'stale' }).mockResolvedValueOnce({ id: 'd1', status: 'archived' }); await markMigrationReferenceDatasetStale({ actor, datasetId: 'd1', reason: 'stale' }); await archiveMigrationReferenceDataset({ actor, datasetId: 'd1', reason: 'archive' }); expect(mocks.audit).toHaveBeenNthCalledWith(1, expect.objectContaining({ eventType: 'migration_reference_dataset_marked_stale', fromValue: 'draft', toValue: 'stale', internalNote: 'stale' })); expect(mocks.audit).toHaveBeenNthCalledWith(2, expect.objectContaining({ eventType: 'migration_reference_dataset_archived', fromValue: 'draft', toValue: 'archived', internalNote: 'archive' })); });
  it('occupation reference add writes occupation creation event', async () => { await addOccupationReference({ actor, datasetId: 'd1', reason: 'add occupation', occupationCode: '111', occupationTitle: 'Dev' }); expect(mocks.createOccupation).toHaveBeenCalled(); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'occupation_reference_created', relatedEntityType: 'migration_reference_dataset', relatedEntityId: 'd1', toValue: 'occupation_reference:o1', internalNote: 'add occupation', reason: 'add occupation' })); });
  it('cost reference add writes cost creation event', async () => { await addCostReference({ actor, datasetId: 'd1', reason: 'add cost', category: 'visa', label: 'fee' }); expect(mocks.createCost).toHaveBeenCalled(); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'cost_reference_created', relatedEntityType: 'migration_reference_dataset', relatedEntityId: 'd1', toValue: 'cost_reference:c1', internalNote: 'add cost', reason: 'add cost' })); });
  it('missing internal reason is rejected for all mutation actions', async () => {
    await expect(createMigrationReferenceDataset({ actor, datasetVersion: 'v1', reason: ' ' })).rejects.toThrow('Internal note/reason is required.');
    await expect(markMigrationReferenceDatasetReviewed({ actor, datasetId: 'd1', reason: '' })).rejects.toThrow('Internal note/reason is required.');
    await expect(approveMigrationReferenceDataset({ actor, datasetId: 'd1', reason: '' })).rejects.toThrow('Internal note/reason is required.');
    await expect(markMigrationReferenceDatasetStale({ actor, datasetId: 'd1', reason: '' })).rejects.toThrow('Internal note/reason is required.');
    await expect(archiveMigrationReferenceDataset({ actor, datasetId: 'd1', reason: '' })).rejects.toThrow('Internal note/reason is required.');
    await expect(addOccupationReference({ actor, datasetId: 'd1', reason: '', occupationCode: '111', occupationTitle: 'Dev' })).rejects.toThrow('Internal note/reason is required.');
    await expect(addCostReference({ actor, datasetId: 'd1', reason: '', category: 'visa', label: 'fee' })).rejects.toThrow('Internal note/reason is required.');
  });
  it('read_only_reviewer cannot mutate reference data', async () => { await expect(createMigrationReferenceDataset({ actor: readOnly as any, datasetVersion: 'v1', reason: 'x' })).rejects.toThrow('Missing permission'); });
  it('no scraping/live update behavior exists', async () => { const text = (await import('node:fs/promises')).readFile('src/server/migrationReferenceData.ts', 'utf8'); await expect(text).resolves.not.toMatch(/fetch\(|axios|http|https|scrape|cron/i); });
});
