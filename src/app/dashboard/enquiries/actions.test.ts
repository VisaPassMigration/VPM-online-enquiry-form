import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  auth: vi.fn(),
  createEnquiry: vi.fn(),
  draftEnquiryFaqEmail: vi.fn(),
  sendEnquiryFaqEmail: vi.fn(),
  findMany: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/server/enquiryCommunications', () => ({ createEnquiry: mocks.createEnquiry, draftEnquiryFaqEmail: mocks.draftEnquiryFaqEmail, sendEnquiryFaqEmail: mocks.sendEnquiryFaqEmail }));
vi.mock('@/server/db', () => ({ db: { enquiry: { findMany: mocks.findMany } } }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

describe('enquiry actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'u1', staffUserId: 's1', roles: ['senior_staff'] } });
    mocks.findMany.mockResolvedValue([]);
  });

  it('create enquiry action works and normalizes email/phone before create', async () => {
    const { runCreateEnquiryAction } = await import('./actions');
    const fd = new FormData(); fd.set('email', '  X@Y.COM  '); fd.set('phone', '  +61 400 000 000  ');
    await runCreateEnquiryAction(fd);
    expect(mocks.createEnquiry).toHaveBeenCalledWith(expect.objectContaining({ email: 'x@y.com', phone: '+61 400 000 000' }));
  });

  it('redirects with a clear duplicate warning when email already exists', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'existing-1', email: 'x@y.com', phone: null }]);
    const { runCreateEnquiryAction } = await import('./actions');
    const fd = new FormData(); fd.set('email', ' X@Y.COM ');

    await expect(runCreateEnquiryAction(fd)).rejects.toThrow('NEXT_REDIRECT:/dashboard/enquiries?duplicateEnquiryId=existing-1');
    expect(mocks.createEnquiry).not.toHaveBeenCalled();
  });

  it('detects conservative digit-only phone duplicates and allows intentional duplicate override', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'existing-phone', email: 'other@example.com', phone: '+61 400 000 000' }]);
    const { runCreateEnquiryAction } = await import('./actions');
    const blocked = new FormData(); blocked.set('email', 'new@example.com'); blocked.set('phone', '61 400 000 000');

    await expect(runCreateEnquiryAction(blocked)).rejects.toThrow('NEXT_REDIRECT:/dashboard/enquiries?duplicateEnquiryId=existing-phone');
    expect(mocks.createEnquiry).not.toHaveBeenCalled();

    const allowed = new FormData(); allowed.set('email', 'new@example.com'); allowed.set('phone', '61 400 000 000'); allowed.set('allowDuplicate', 'on');
    await runCreateEnquiryAction(allowed);
    expect(mocks.createEnquiry).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com', phone: '61 400 000 000' }));
  });

  it('draft FAQ email action works', async () => {
    const { runDraftFaqAction } = await import('./actions');
    const fd = new FormData(); fd.set('enquiryId', 'e1'); fd.set('template', 'faq_student_visa');
    await runDraftFaqAction(fd);
    expect(mocks.draftEnquiryFaqEmail).toHaveBeenCalledWith(expect.objectContaining({ enquiryId: 'e1', type: 'faq_student_visa' }));
  });

  it('send FAQ email action works and requires internal reason', async () => {
    const { runSendFaqAction } = await import('./actions');
    const fd = new FormData(); fd.set('communicationId', 'c1'); fd.set('internalReason', 'info only');
    await runSendFaqAction(fd);
    expect(mocks.sendEnquiryFaqEmail).toHaveBeenCalledWith(expect.objectContaining({ communicationId: 'c1', internalReason: 'info only' }));
  });

  it('read_only_reviewer cannot send', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('Missing permission'));
    const { runSendFaqAction } = await import('./actions');
    const fd = new FormData(); fd.set('communicationId', 'c1'); fd.set('internalReason', 'info only');
    await expect(runSendFaqAction(fd)).rejects.toThrow('Missing permission');
  });
});
