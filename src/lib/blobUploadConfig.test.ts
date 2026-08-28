import { describe, expect, it } from 'vitest';

import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  INTAKE_DOCUMENT_PATH_PREFIX,
  MAX_DOCUMENT_UPLOAD_BYTES,
  resolveIntakeDocumentUploadTokenOptions,
} from './blobUploadConfig';

describe('resolveIntakeDocumentUploadTokenOptions', () => {
  it('rejects pathnames outside the intake document namespace', () => {
    expect(() => resolveIntakeDocumentUploadTokenOptions('other-place/passport.pdf')).toThrow(
      `Uploads are only accepted under the ${INTAKE_DOCUMENT_PATH_PREFIX} path.`,
    );
  });

  it('returns upload constraints for a pathname inside the intake document namespace', () => {
    const options = resolveIntakeDocumentUploadTokenOptions(`${INTAKE_DOCUMENT_PATH_PREFIX}passportBioPage-passport.pdf`);

    expect(options).toEqual({
      allowedContentTypes: ALLOWED_DOCUMENT_CONTENT_TYPES,
      maximumSizeInBytes: MAX_DOCUMENT_UPLOAD_BYTES,
      addRandomSuffix: true,
    });
  });
});
