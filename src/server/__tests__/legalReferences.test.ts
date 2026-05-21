import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), findMany: vi.fn(), audit: vi.fn() }));
vi.mock('../audit', () => ({ recordAuditEvent: mocks.audit }));
vi.mock('../db', () => ({ db: { legalReference: { create: mocks.create, findUniqueOrThrow: mocks.findUniqueOrThrow, update: mocks.update, findMany: mocks.findMany } } }));
import { approveLegalReference, archiveLegalReference, createLegalReference, listApprovedLegalReferencesForTopic, markLegalReferenceReviewed, markLegalReferenceStale, updateLegalReference } from '../legalReferences';

const actor = { actorId: 'a1', actorName: 'Admin', actorRole: 'boss_admin' as const, actorStaffUserId: 's1', actorRoles: ['boss_admin'] as const };
const readOnly = { ...actor, actorRole: 'read_only_reviewer' as const, actorRoles: ['read_only_reviewer'] as const };
const spoofedRoles = { ...actor, actorRoles: [' BOSS_ADMIN ', 'not_a_role'] as any };

beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ id: 'l1', status: 'draft' }); mocks.findUniqueOrThrow.mockResolvedValue({ id: 'l1', status: 'draft', version: 1 }); mocks.update.mockResolvedValue({ id: 'l1', status: 'reviewed', version: 2 }); mocks.findMany.mockResolvedValue([{ id: 'l1', status: 'approved', topic: 'character' }]); });

describe('legal references service', () => {
  it('writes create/update/review/approve/stale/archive audit events', async () => {
    mocks.findUniqueOrThrow
      .mockResolvedValueOnce({ id: 'l1', status: 'draft', version: 1 })
      .mockResolvedValueOnce({ id: 'l1', status: 'draft', version: 1 })
      .mockResolvedValueOnce({ id: 'l1', status: 'reviewed', version: 2 })
      .mockResolvedValueOnce({ id: 'l1', status: 'approved', version: 3 })
      .mockResolvedValueOnce({ id: 'l1', status: 'stale', version: 4 });
    await createLegalReference({ actor, reason: 'create', referenceType: 'act_section', jurisdiction: 'AU', sectionOrSchedule: 's48', topic: 'section_48_bar', summary: 'x' });
    await updateLegalReference({ actor, legalReferenceId: 'l1', reason: 'update', data: { summary: 'y' } });
    await markLegalReferenceReviewed({ actor, legalReferenceId: 'l1', reason: 'review' });
    mocks.update.mockResolvedValueOnce({ id: 'l1', status: 'approved', version: 3 });
    await approveLegalReference({ actor, legalReferenceId: 'l1', reason: 'approve' });
    mocks.update.mockResolvedValueOnce({ id: 'l1', status: 'stale', version: 4 });
    await markLegalReferenceStale({ actor, legalReferenceId: 'l1', reason: 'stale' });
    mocks.update.mockResolvedValueOnce({ id: 'l1', status: 'archived', version: 5 });
    await archiveLegalReference({ actor, legalReferenceId: 'l1', reason: 'archive' });
    expect(mocks.audit).toHaveBeenCalledTimes(6);
  });
  it('missing internal reason is rejected', async () => { await expect(createLegalReference({ actor, reason: ' ', referenceType: 'act_section', jurisdiction: 'AU', sectionOrSchedule: 's48', topic: 'section_48_bar', summary: 'x' })).rejects.toThrow('Internal note/reason is required.'); });
  it('read_only_reviewer cannot mutate', async () => { await expect(createLegalReference({ actor: readOnly as any, reason: 'x', referenceType: 'act_section', jurisdiction: 'AU', sectionOrSchedule: 's48', topic: 'section_48_bar', summary: 'x' })).rejects.toThrow('Missing permission'); });
  it('approved lookup returns approved references only', async () => { await listApprovedLegalReferencesForTopic('character'); expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { topic: 'character', status: 'approved' } })); });
  it('non-canonical actor roles do not grant permissions', async () => {
    await expect(markLegalReferenceReviewed({ actor: spoofedRoles, legalReferenceId: 'l1', reason: 'review' })).rejects.toThrow('Missing permission');
  });
  it('blocks invalid transitions and does not write mutation audit', async () => {
    mocks.findUniqueOrThrow.mockResolvedValueOnce({ id: 'l1', status: 'draft', version: 1 });
    await expect(approveLegalReference({ actor, legalReferenceId: 'l1', reason: 'approve' })).rejects.toThrow('Invalid legal reference status transition: draft -> approved.');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('archived references cannot transition further', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ id: 'l1', status: 'archived', version: 1 });
    await expect(markLegalReferenceReviewed({ actor, legalReferenceId: 'l1', reason: 'review' })).rejects.toThrow('Invalid legal reference status transition: archived -> reviewed.');
    await expect(approveLegalReference({ actor, legalReferenceId: 'l1', reason: 'approve' })).rejects.toThrow('Invalid legal reference status transition: archived -> approved.');
    await expect(markLegalReferenceStale({ actor, legalReferenceId: 'l1', reason: 'stale' })).rejects.toThrow('Invalid legal reference status transition: archived -> stale.');
    await expect(archiveLegalReference({ actor, legalReferenceId: 'l1', reason: 'archive' })).rejects.toThrow('Invalid legal reference status transition: archived -> archived.');
  });
  it('valid transitions still work', async () => {
    mocks.findUniqueOrThrow.mockResolvedValueOnce({ id: 'l1', status: 'draft', version: 1 });
    mocks.update.mockResolvedValueOnce({ id: 'l1', status: 'reviewed', version: 2 });
    await expect(markLegalReferenceReviewed({ actor, legalReferenceId: 'l1', reason: 'review' })).resolves.toMatchObject({ status: 'reviewed' });
    mocks.findUniqueOrThrow.mockResolvedValueOnce({ id: 'l1', status: 'reviewed', version: 2 });
    mocks.update.mockResolvedValueOnce({ id: 'l1', status: 'approved', version: 3 });
    await expect(approveLegalReference({ actor, legalReferenceId: 'l1', reason: 'approve' })).resolves.toMatchObject({ status: 'approved' });
  });
  it('update audit metadata includes changedFields', async () => {
    mocks.findUniqueOrThrow.mockResolvedValueOnce({ id: 'l1', status: 'draft', version: 1, summary: 'x' });
    mocks.update.mockResolvedValueOnce({ id: 'l1', status: 'draft', version: 2, summary: 'y' });
    await updateLegalReference({ actor, legalReferenceId: 'l1', reason: 'update summary', data: { summary: 'y' } });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ changedFields: ['summary'] }) }));
  });
  it('no LEGENDcom scraping/live fetch behavior exists', async () => { const text = (await import('node:fs/promises')).readFile('src/server/legalReferences.ts', 'utf8'); await expect(text).resolves.not.toMatch(/fetch\(|axios|http|https|scrape/i); });
});
