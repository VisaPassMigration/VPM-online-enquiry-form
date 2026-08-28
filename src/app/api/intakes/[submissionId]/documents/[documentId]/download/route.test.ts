import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  findUniqueMock: vi.fn(),
  issueSignedTokenMock: vi.fn(),
  presignUrlMock: vi.fn(),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));
vi.mock('@/server/db', () => ({ db: { submissionDocument: { findUnique: mocks.findUniqueMock } } }));
vi.mock('@vercel/blob', () => ({
  issueSignedToken: mocks.issueSignedTokenMock,
  presignUrl: mocks.presignUrlMock,
}));

import { PERMISSIONS } from '@/server/auth/permissions';
import { GET } from './route';

describe('GET /api/intakes/[submissionId]/documents/[documentId]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermissionMock.mockResolvedValue(undefined);
    mocks.findUniqueMock.mockResolvedValue({ id: 'doc-1', submissionId: 'sub-1', storageKey: 'intake-documents/passportBioPage-passport.pdf' });
    mocks.issueSignedTokenMock.mockResolvedValue({ delegationToken: 'delegation', clientSigningToken: 'signing', validUntil: 123 });
    mocks.presignUrlMock.mockResolvedValue({ presignedUrl: 'https://example.blob.vercel-storage.com/intake-documents/passportBioPage-passport.pdf?signed=1' });
  });

  const call = (submissionId: string, documentId: string) =>
    GET(new Request('http://localhost'), { params: Promise.resolve({ submissionId, documentId }) });

  it('checks the same permission that gates the intake detail page before doing anything else', async () => {
    await call('sub-1', 'doc-1');
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.VIEW_INTAKE_DETAILS);
  });

  it('redirects to a short-lived presigned URL for a matching document', async () => {
    const response = await call('sub-1', 'doc-1');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.blob.vercel-storage.com/intake-documents/passportBioPage-passport.pdf?signed=1');
    expect(mocks.issueSignedTokenMock).toHaveBeenCalledWith(expect.objectContaining({
      pathname: 'intake-documents/passportBioPage-passport.pdf',
      operations: ['get'],
    }));
    expect(mocks.presignUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ delegationToken: 'delegation', clientSigningToken: 'signing' }),
      expect.objectContaining({ operation: 'get', pathname: 'intake-documents/passportBioPage-passport.pdf', access: 'private' }),
    );
  });

  it('returns 404 without generating a URL when the document does not exist', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce(null);
    const response = await call('sub-1', 'missing-doc');
    expect(response.status).toBe(404);
    expect(mocks.issueSignedTokenMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the document belongs to a different submission', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({ id: 'doc-1', submissionId: 'sub-2', storageKey: 'intake-documents/other.pdf' });
    const response = await call('sub-1', 'doc-1');
    expect(response.status).toBe(404);
    expect(mocks.issueSignedTokenMock).not.toHaveBeenCalled();
  });
});
