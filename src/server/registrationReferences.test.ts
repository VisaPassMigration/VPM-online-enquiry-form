import type { Prisma } from '@prisma/client';

import { describe, expect, it } from 'vitest';

import {
  displayRegistrationReference,
  fallbackRegistrationReference,
  formatRegistrationReference,
  nextRegistrationReference,
  type RegistrationReferenceTx,
} from './registrationReferences';

const assertRegistrationReferenceTx = (_tx: RegistrationReferenceTx) => undefined;
const assertPrismaTransactionClientCompatibility = (tx: Prisma.TransactionClient) => assertRegistrationReferenceTx(tx);
void assertPrismaTransactionClientCompatibility;

describe('registration references', () => {
  it('formats persisted registration references as VPM-REG-DDMMYY-XXXX', () => {
    expect(formatRegistrationReference(new Date('2026-06-03T10:15:00.000Z'), 1)).toBe('VPM-REG-030626-0001');
    expect(formatRegistrationReference(new Date('2026-06-03T13:59:00.000Z'), 42)).toBe('VPM-REG-030626-0042');
  });

  it('uses the next daily sequence from the latest persisted reference', async () => {
    const tx = {
      intakeSubmission: {
        findFirst: async () => ({ registrationReference: 'VPM-REG-030626-0007' }),
      },
    };

    await expect(nextRegistrationReference(tx, new Date('2026-06-03T10:15:00.000Z'))).resolves.toBe('VPM-REG-030626-0008');
  });

  it('falls back to date plus a derived UUID suffix when an older record has no persisted reference', () => {
    expect(fallbackRegistrationReference({
      id: '6f36b53d-3f13-49ef-81e8-2ac6d75fabcd',
      submittedAt: new Date('2026-06-03T10:15:00.000Z'),
    })).toBe('VPM-REG-030626-ABCD');
  });

  it('prefers a persisted registration reference for display', () => {
    expect(displayRegistrationReference({
      id: '6f36b53d-3f13-49ef-81e8-2ac6d75fabcd',
      registrationReference: 'VPM-REG-030626-0001',
      submittedAt: new Date('2026-06-03T10:15:00.000Z'),
    })).toBe('VPM-REG-030626-0001');
  });
});
