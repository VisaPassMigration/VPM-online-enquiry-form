/**
 * Shared between the public intake page (client component) and the blob
 * upload authorization route (server-only). Kept dependency-free so it's
 * safe to import from either side of the client/server boundary.
 */
export const INTAKE_DOCUMENT_PATH_PREFIX = 'intake-documents/';
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * Only the public registration form uploads through this path today, so the
 * one thing worth enforcing server-side is that a token can't be minted for
 * an arbitrary path outside the intake document namespace.
 */
export function resolveIntakeDocumentUploadTokenOptions(pathname: string) {
  if (!pathname.startsWith(INTAKE_DOCUMENT_PATH_PREFIX)) {
    throw new Error(`Uploads are only accepted under the ${INTAKE_DOCUMENT_PATH_PREFIX} path.`);
  }

  return {
    allowedContentTypes: ALLOWED_DOCUMENT_CONTENT_TYPES,
    maximumSizeInBytes: MAX_DOCUMENT_UPLOAD_BYTES,
    addRandomSuffix: true,
  };
}
