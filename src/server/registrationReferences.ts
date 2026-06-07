const REGISTRATION_REFERENCE_PREFIX = 'VPM-REG';
const DAILY_SEQUENCE_WIDTH = 4;

type RegistrationReferenceTx = {
  intakeSubmission: {
    findFirst: (args: {
      where: { registrationReference: { startsWith: string } };
      orderBy: { registrationReference: 'desc' };
      select: { registrationReference: true };
    }) => Promise<{ registrationReference: string | null } | null>;
  };
};

const registrationDateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  timeZone: 'Australia/Perth',
});

export function registrationReferenceDatePart(date: Date) {
  const parts = registrationDateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '00';
  return `${part('day')}${part('month')}${part('year')}`;
}

export function registrationReferencePrefixForDate(date: Date) {
  return `${REGISTRATION_REFERENCE_PREFIX}-${registrationReferenceDatePart(date)}`;
}

export function formatRegistrationReference(date: Date, dailySequence: number) {
  if (!Number.isInteger(dailySequence) || dailySequence < 1 || dailySequence > 9999) {
    throw new Error('Registration reference daily sequence must be between 1 and 9999.');
  }

  return `${registrationReferencePrefixForDate(date)}-${String(dailySequence).padStart(DAILY_SEQUENCE_WIDTH, '0')}`;
}

export function fallbackRegistrationReference(input: { id: string; submittedAt?: Date | null; createdAt?: Date | null }) {
  const referenceDate = input.submittedAt ?? input.createdAt ?? new Date(0);
  const safeSuffix = input.id.replace(/[^a-z0-9]/gi, '').slice(-DAILY_SEQUENCE_WIDTH).toUpperCase().padStart(DAILY_SEQUENCE_WIDTH, '0');
  return `${registrationReferencePrefixForDate(referenceDate)}-${safeSuffix}`;
}

export function displayRegistrationReference(input: { id: string; registrationReference?: string | null; submittedAt?: Date | null; createdAt?: Date | null }) {
  return input.registrationReference ?? fallbackRegistrationReference(input);
}

export async function nextRegistrationReference(tx: RegistrationReferenceTx, date: Date) {
  const prefix = registrationReferencePrefixForDate(date);
  const latest = await tx.intakeSubmission.findFirst({
    where: { registrationReference: { startsWith: `${prefix}-` } },
    orderBy: { registrationReference: 'desc' },
    select: { registrationReference: true },
  });
  const latestSequence = latest?.registrationReference ? Number(latest.registrationReference.slice(-DAILY_SEQUENCE_WIDTH)) : 0;

  return formatRegistrationReference(date, latestSequence + 1);
}

export function isRegistrationReferenceUniqueConflict(error: unknown) {
  const maybePrismaError = error as { code?: string; meta?: { target?: string[] | string } };
  if (maybePrismaError.code !== 'P2002') return false;
  const target = maybePrismaError.meta?.target;
  return Array.isArray(target) ? target.includes('registrationReference') : target === 'registrationReference';
}
