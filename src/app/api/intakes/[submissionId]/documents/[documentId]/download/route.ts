import { issueSignedToken, presignUrl } from '@vercel/blob';
import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
import { db } from '@/server/db';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIGNED_URL_TTL_MS = 5 * 60 * 1000;

type RouteContext = { params: Promise<{ submissionId: string; documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  // Same gate as the staff dashboard's document tab, which is only reachable
  // once VIEW_INTAKE_DETAILS has already passed for the whole intake page.
  await requirePermission(PERMISSIONS.VIEW_INTAKE_DETAILS);

  const { submissionId, documentId } = await context.params;
  const document = await db.submissionDocument.findUnique({ where: { id: documentId } });

  if (!document || document.submissionId !== submissionId) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const validUntil = Date.now() + SIGNED_URL_TTL_MS;
  const signedToken = await issueSignedToken({ pathname: document.storageKey, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(
    signedToken,
    { operation: 'get', pathname: document.storageKey, validUntil, access: 'private' },
  );

  return NextResponse.redirect(presignedUrl);
}
