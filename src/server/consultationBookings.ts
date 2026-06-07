import { Prisma, type AuditEventType } from '@prisma/client';
import { recordAuditEvent } from './audit';
import { db } from './db';

/**
 * Internal operational consultation tracking service.
 * No client outcome is sent from these functions; all updates are staff-controlled.
 * Calendar and payment provider integrations are future phases and intentionally excluded.
 */

type ActorContext = {
  actorId: string;
  actorRole: string;
  actorName?: string;
  actorStaffUserId?: string;
};

type ReasonContext = ActorContext & {
  reason: string;
};

type DbClient = Prisma.TransactionClient;
type ConsultationStatus = 'invited' | 'booked' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';

const ALLOWED_TRANSITIONS: Record<ConsultationStatus, ConsultationStatus[]> = {
  invited: ['booked', 'cancelled'],
  booked: ['completed', 'no_show', 'cancelled', 'rescheduled'],
  rescheduled: ['booked', 'completed', 'no_show', 'cancelled'],
  cancelled: [],
  no_show: [],
  completed: [],
};

function assertActor(context: ActorContext) {
  if (!context.actorId.trim()) throw new Error('actorId is required.');
  if (!context.actorRole.trim()) throw new Error('actorRole is required.');
}

function assertReason(reason: string, fieldName = 'reason') {
  if (!reason.trim()) throw new Error(`${fieldName} is required.`);
}

function appendInternalNote(existingNote: string | null | undefined, nextNote: string) {
  const trimmed = nextNote.trim();
  if (!trimmed) return existingNote ?? undefined;
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${trimmed}`;
  return existingNote?.trim() ? `${existingNote.trim()}\n${entry}` : entry;
}

async function writeAuditEvent(
  _tx: DbClient,
  input: {
    submissionId: string;
    eventType: AuditEventType;
    actorId: string;
    actorRole: string;
    actorName?: string;
    actorStaffUserId?: string;
    reason: string;
    metadata?: Record<string, unknown>;
    relatedEntityId?: string;
    fromStatus?: ConsultationStatus;
    toStatus?: ConsultationStatus;
  },
) {
  await recordAuditEvent({
    submissionId: input.submissionId,
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    actorName: input.actorName,
    reason: input.reason,
    internalNote: input.reason,
    actorStaffUserId: input.actorStaffUserId,
    metadata: { ...(input.metadata ?? {}), ...(input.actorStaffUserId ? { actorStaffUserId: input.actorStaffUserId } : {}) },
    relatedEntityType: 'consultation_booking',
    relatedEntityId: input.relatedEntityId,
    fromValue: input.fromStatus,
    toValue: input.toStatus,
    eventSource: 'consultation_booking_action',
  });
}

export async function createConsultationBooking(
  input: {
    submissionId: string;
    clientName: string;
    clientEmail: string;
    assignedSeniorStaffId?: string;
    assignedSeniorStaffName?: string;
    bookingDateTime?: Date;
    bookingTimezone?: string;
    bookingSource?: 'manual_staff_entry' | 'internal_booking_link' | 'calendly' | 'google_calendar' | 'other';
    notesInternal?: string;
  } & ReasonContext,
) {
  assertActor(input);
  assertReason(input.reason, 'internal note/reason');

  return db.$transaction(async (tx) => {
    const booking = await tx.consultationBooking.create({
      data: {
        submissionId: input.submissionId,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        assignedSeniorStaffId: input.assignedSeniorStaffId,
        assignedSeniorStaffName: input.assignedSeniorStaffName,
        bookingDateTime: input.bookingDateTime,
        bookingTimezone: input.bookingTimezone,
        bookingSource: input.bookingSource ?? 'manual_staff_entry',
        notesInternal: appendInternalNote(undefined, input.notesInternal ?? input.reason),
        status: 'invited',
        invitedAt: new Date(),
      },
    });

    await writeAuditEvent(tx, {
      submissionId: input.submissionId,
      eventType: 'consultation_invited',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorName: input.actorName,
      actorStaffUserId: input.actorStaffUserId,
      reason: input.reason,
      metadata: { consultationBookingId: booking.id },
      relatedEntityId: booking.id,
      toStatus: 'invited',
    });

    return booking;
  });
}

async function transitionConsultationStatus(
  bookingId: string,
  submissionId: string,
  toStatus: ConsultationStatus,
  eventType: AuditEventType,
  context: ReasonContext,
) {
  assertActor(context);
  assertReason(context.reason, 'internal note/reason');

  return db.$transaction(async (tx) => {
    const bookingBeforeUpdate = await tx.consultationBooking.findUnique({
      where: { id: bookingId },
      select: { status: true, notesInternal: true },
    });

    if (!bookingBeforeUpdate) {
      throw new Error(`Consultation booking ${bookingId} was not found.`);
    }

    const fromStatus = bookingBeforeUpdate.status as ConsultationStatus;
    const allowedNextStatuses = ALLOWED_TRANSITIONS[fromStatus] ?? [];

    if (!allowedNextStatuses.includes(toStatus)) {
      const allowedLabels = allowedNextStatuses.length > 0 ? allowedNextStatuses.join(', ') : 'none';
      const blockedReason = `Blocked consultation status transition from ${fromStatus} to ${toStatus}. Allowed next statuses from ${fromStatus}: ${allowedLabels}.`;

      await writeAuditEvent(tx, {
        submissionId,
        eventType: 'consultation_rescheduled',
        actorId: context.actorId,
        actorRole: context.actorRole,
        actorName: context.actorName,
        actorStaffUserId: context.actorStaffUserId,
        reason: `REJECTED_STATUS_TRANSITION: ${context.reason}`,
        metadata: {
          consultationBookingId: bookingId,
          fromStatus,
          toStatus,
          blocked: true,
          blockedReason,
        },
        relatedEntityId: bookingId,
        fromStatus,
        toStatus,
      });

      throw new Error(blockedReason);
    }

    const now = new Date();
    const timestampUpdate: Partial<Prisma.ConsultationBookingUpdateInput> = {
      notesInternal: appendInternalNote(bookingBeforeUpdate.notesInternal, context.reason),
    };

    if (toStatus === 'booked') {
      timestampUpdate.bookedAt = now;
    } else if (toStatus === 'completed') {
      timestampUpdate.completedAt = now;
    } else if (toStatus === 'no_show') {
      timestampUpdate.noShowAt = now;
    } else if (toStatus === 'cancelled') {
      timestampUpdate.cancelledAt = now;
    } else if (toStatus === 'rescheduled') {
      timestampUpdate.rescheduledAt = now;
    }

    const booking = await tx.consultationBooking.update({
      where: { id: bookingId },
      data: {
        status: toStatus,
        ...timestampUpdate,
      },
    });

    await writeAuditEvent(tx, {
      submissionId,
      eventType,
      actorId: context.actorId,
      actorRole: context.actorRole,
      actorName: context.actorName,
      actorStaffUserId: context.actorStaffUserId,
      reason: context.reason,
      metadata: { consultationBookingId: bookingId, toStatus: toStatus },
      relatedEntityId: bookingId,
      fromStatus,
      toStatus,
    });

    return booking;
  });
}

export function markConsultationBooked(input: { bookingId: string; submissionId: string } & ReasonContext) {
  return transitionConsultationStatus(input.bookingId, input.submissionId, 'booked', 'consultation_booked', input);
}

export function markConsultationCompleted(input: { bookingId: string; submissionId: string } & ReasonContext) {
  return transitionConsultationStatus(input.bookingId, input.submissionId, 'completed', 'consultation_completed', input);
}

export function markConsultationNoShow(input: { bookingId: string; submissionId: string } & ReasonContext) {
  return transitionConsultationStatus(input.bookingId, input.submissionId, 'no_show', 'consultation_no_show', input);
}

export function markConsultationCancelled(input: { bookingId: string; submissionId: string } & ReasonContext) {
  return transitionConsultationStatus(input.bookingId, input.submissionId, 'cancelled', 'consultation_cancelled', input);
}

export function markConsultationRescheduled(input: { bookingId: string; submissionId: string } & ReasonContext) {
  return transitionConsultationStatus(input.bookingId, input.submissionId, 'rescheduled', 'consultation_rescheduled', input);
}

export async function recordConsultationOutcome(input: {
  bookingId: string;
  submissionId: string;
  outcome: string;
  csaRecommended: boolean;
} & ReasonContext) {
  assertActor(input);
  assertReason(input.reason, 'internal note/reason');

  return db.$transaction(async (tx) => {
    const existing = await tx.consultationBooking.findUnique({
      where: { id: input.bookingId },
      select: { notesInternal: true },
    });
    const booking = await tx.consultationBooking.update({
      where: { id: input.bookingId },
      data: {
        consultationOutcome: input.outcome,
        csaRecommended: input.csaRecommended,
        notesInternal: appendInternalNote(existing?.notesInternal, input.reason),
      },
    });

    await writeAuditEvent(tx, {
      submissionId: input.submissionId,
      eventType: 'consultation_outcome_recorded',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorName: input.actorName,
      actorStaffUserId: input.actorStaffUserId,
      reason: input.reason,
      metadata: { consultationBookingId: input.bookingId, csaRecommended: input.csaRecommended },
      relatedEntityId: input.bookingId,
    });

    return booking;
  });
}

export async function markCsaIssued(input: { bookingId: string; submissionId: string } & ReasonContext) {
  assertActor(input);
  assertReason(input.reason, 'internal note/reason');

  return db.$transaction(async (tx) => {
    const existing = await tx.consultationBooking.findUnique({
      where: { id: input.bookingId },
      select: { notesInternal: true },
    });
    const booking = await tx.consultationBooking.update({
      where: { id: input.bookingId },
      data: {
        csaIssued: true,
        csaIssuedAt: new Date(),
        notesInternal: appendInternalNote(existing?.notesInternal, input.reason),
      },
    });

    await writeAuditEvent(tx, {
      submissionId: input.submissionId,
      eventType: 'csa_issued',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorName: input.actorName,
      actorStaffUserId: input.actorStaffUserId,
      reason: input.reason,
      metadata: { consultationBookingId: input.bookingId },
      relatedEntityId: input.bookingId,
    });

    return booking;
  });
}

export async function markDepositPaid(input: { bookingId: string; submissionId: string } & ReasonContext) {
  assertActor(input);
  assertReason(input.reason, 'internal note/reason');

  return db.$transaction(async (tx) => {
    const existing = await tx.consultationBooking.findUnique({
      where: { id: input.bookingId },
      select: { notesInternal: true },
    });
    const booking = await tx.consultationBooking.update({
      where: { id: input.bookingId },
      data: {
        depositPaid: true,
        depositPaidAt: new Date(),
        notesInternal: appendInternalNote(existing?.notesInternal, input.reason),
      },
    });

    await writeAuditEvent(tx, {
      submissionId: input.submissionId,
      eventType: 'deposit_recorded',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorName: input.actorName,
      actorStaffUserId: input.actorStaffUserId,
      reason: input.reason,
      metadata: { consultationBookingId: input.bookingId },
      relatedEntityId: input.bookingId,
    });

    return booking;
  });
}
