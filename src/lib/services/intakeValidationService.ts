import { intakeSubmissionSchema, type IntakeSubmissionInput } from '@/lib/schemas/intakeSubmission';

export function validateIntakeSubmission(payload: unknown): IntakeSubmissionInput {
  return intakeSubmissionSchema.parse(payload);
}

export function safeValidateIntakeSubmission(payload: unknown) {
  return intakeSubmissionSchema.safeParse(payload);
}
