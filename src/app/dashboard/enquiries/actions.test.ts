import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  auth: vi.fn(),
  createEnquiry: vi.fn(),
  draftEnquiryFaqEmail: vi.fn(),
  sendEnquiryFaqEmail: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/server/enquiryCommunications', () => ({ createEnquiry: mocks.createEnquiry, draftEnquiryFaqEmail: mocks.draftEnquiryFaqEmail, sendEnquiryFaqEmail: mocks.sendEnquiryFaqEmail }));
vi.mock('@/server/db', () => ({ db: { enquiry: { findMany: mocks.findMany } } }));

describe('enquiry actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'u1', staffUserId: 's1', roles: ['senior_staff'] } });
    mocks.findMany.mockResolvedValue([]);
  });

  it('create enquiry action works', async () => {
    const { runCreateEnquiryAction } = await import('./page');
    const fd = new FormData(); fd.set('email', 'x@y.com');
    await runCreateEnquiryAction(fd);
    expect(mocks.createEnquiry).toHaveBeenCalledWith(expect.objectContaining({ email: 'x@y.com' }));
  });

  it('draft FAQ email action works', async () => {
    const { runDraftFaqAction } = await import('./page');
    const fd = new FormData(); fd.set('enquiryId', 'e1'); fd.set('template', 'faq_student_visa');
    await runDraftFaqAction(fd);
    expect(mocks.draftEnquiryFaqEmail).toHaveBeenCalledWith(expect.objectContaining({ enquiryId: 'e1', type: 'faq_student_visa' }));
  });

  it('send FAQ email action works and requires internal reason', async () => {
    const { runSendFaqAction } = await import('./page');
    const fd = new FormData(); fd.set('communicationId', 'c1'); fd.set('internalReason', 'info only');
    await runSendFaqAction(fd);
    expect(mocks.sendEnquiryFaqEmail).toHaveBeenCalledWith(expect.objectContaining({ communicationId: 'c1', internalReason: 'info only' }));
  });

  it('read_only_reviewer cannot send', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('Missing permission'));
    const { runSendFaqAction } = await import('./page');
    const fd = new FormData(); fd.set('communicationId', 'c1'); fd.set('internalReason', 'info only');
    await expect(runSendFaqAction(fd)).rejects.toThrow('Missing permission');
  });
});
