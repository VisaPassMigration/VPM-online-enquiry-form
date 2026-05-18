import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, findUniqueMock, updateMock, recordAuditEventMock, countMock, groupByMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
  countMock: vi.fn(),
  groupByMock: vi.fn(),
}));

vi.mock('../audit', () => ({ recordAuditEvent: recordAuditEventMock }));

vi.mock('../db', () => {
  const tx = {
    consultationBooking: { create: createMock, findUnique: findUniqueMock, update: updateMock },
  };

  return {
    db: {
      $transaction: vi.fn((cb: (tx: typeof tx) => unknown) => cb(tx)),
      consultationBooking: {
        count: countMock,
        groupBy: groupByMock,
      },
    },
  };
});

import {
  createConsultationBooking,
  markConsultationBooked,
  markConsultationCancelled,
  markConsultationCompleted,
  markConsultationNoShow,
  markConsultationRescheduled,
  markCsaIssued,
  markDepositPaid,
} from '../consultationBookings';
import { getCompletedToCsaIssuedConversion, getCsaIssuedToDepositPaidConversion, getRemainingWeeklyCapacity, getWeeklyCapacityTarget } from '../consultationKpis';

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueMock.mockResolvedValue({ status: 'booked' });
});

describe('consultation booking service', () => {
  it('creates a booking record with invited status shape and creates audit event', async () => {
    createMock.mockResolvedValue({ id: 'booking-1' });

    await createConsultationBooking({
      submissionId: 'sub-1',
      clientName: 'Jane',
      clientEmail: 'jane@example.com',
      actorId: 'staff-1',
      actorRole: 'staff',
      reason: 'Initial consult invite approved by staff',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId: 'sub-1',
          clientName: 'Jane',
          clientEmail: 'jane@example.com',
          status: 'invited',
        }),
      }),
    );
    expect(recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'consultation_invited' }));
  });

  it('allows invited -> booked transition', async () => {
    findUniqueMock.mockResolvedValue({ status: 'invited' });
    updateMock.mockResolvedValue({ id: 'booking-1' });

    await markConsultationBooked({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'booked', bookedAt: expect.any(Date) }) }));
  });

  it('allows booked -> completed transition', async () => {
    findUniqueMock.mockResolvedValue({ status: 'booked' });
    updateMock.mockResolvedValue({ id: 'booking-1' });

    await markConsultationCompleted({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'completed', completedAt: expect.any(Date) }) }));
  });

  it('allows booked transitions to no_show, cancelled, and rescheduled', async () => {
    updateMock.mockResolvedValue({ id: 'booking-1' });
    const base = { bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' };

    findUniqueMock.mockResolvedValueOnce({ status: 'booked' });
    await markConsultationNoShow(base);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'no_show', noShowAt: expect.any(Date) }) }));

    findUniqueMock.mockResolvedValueOnce({ status: 'booked' });
    await markConsultationCancelled(base);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled', cancelledAt: expect.any(Date) }) }));

    findUniqueMock.mockResolvedValueOnce({ status: 'booked' });
    await markConsultationRescheduled(base);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'rescheduled', rescheduledAt: expect.any(Date) }) }));
  });

  it('allows rescheduled -> booked transition', async () => {
    findUniqueMock.mockResolvedValue({ status: 'rescheduled' });
    updateMock.mockResolvedValue({ id: 'booking-1' });

    await markConsultationBooked({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'booked', bookedAt: expect.any(Date) }) }));
  });

  it('blocks invited -> completed transition', async () => {
    findUniqueMock.mockResolvedValue({ status: 'invited' });

    await expect(
      markConsultationCompleted({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' }),
    ).rejects.toThrow('Blocked consultation status transition from invited to completed.');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('blocks cancelled -> booked transition', async () => {
    findUniqueMock.mockResolvedValue({ status: 'cancelled' });

    await expect(markConsultationBooked({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' })).rejects.toThrow(
      'Blocked consultation status transition from cancelled to booked.',
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('blocks no_show -> completed transition', async () => {
    findUniqueMock.mockResolvedValue({ status: 'no_show' });

    await expect(markConsultationCompleted({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' })).rejects.toThrow(
      'Blocked consultation status transition from no_show to completed.',
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('blocks completed -> booked transition', async () => {
    findUniqueMock.mockResolvedValue({ status: 'completed' });

    await expect(markConsultationBooked({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' })).rejects.toThrow(
      'Blocked consultation status transition from completed to booked.',
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('creates status audit events for allowed transitions', async () => {
    updateMock.mockResolvedValue({ id: 'booking-1' });
    findUniqueMock.mockResolvedValue({ status: 'booked' });
    const base = { bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'staff update' };

    await markConsultationCompleted(base);
    findUniqueMock.mockResolvedValue({ status: 'booked' });
    await markConsultationNoShow(base);
    findUniqueMock.mockResolvedValue({ status: 'booked' });
    await markConsultationCancelled(base);
    findUniqueMock.mockResolvedValue({ status: 'booked' });
    await markConsultationRescheduled(base);

    const auditEventTypes = recordAuditEventMock.mock.calls.map((call) => call[0].eventType);
    expect(auditEventTypes).toEqual(expect.arrayContaining(['consultation_completed', 'consultation_no_show', 'consultation_cancelled', 'consultation_rescheduled']));
  });


  it('audit event includes actorId and actorName for booking actions', async () => {
    findUniqueMock.mockResolvedValue({ status: 'invited' });
    updateMock.mockResolvedValue({ id: 'booking-1' });

    await markConsultationBooked({
      bookingId: 'booking-1',
      submissionId: 'sub-1',
      actorId: 'staff-1',
      actorName: 'Jane Reviewer',
      actorRole: 'senior_staff',
      actorStaffUserId: 'staff-1',
      reason: 'note',
    });

    expect(recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'staff-1',
      actorName: 'Jane Reviewer',
      actorRole: 'senior_staff',
      relatedEntityType: 'consultation_booking',
      relatedEntityId: 'booking-1',
      internalNote: 'note',
      fromValue: 'invited',
      toValue: 'booked',
      eventSource: 'consultation_booking_action',
      metadata: expect.objectContaining({ actorStaffUserId: 'staff-1' }),
    }));
  });

  it('sets CSA issued and deposit paid timestamps', async () => {
    updateMock.mockResolvedValue({ id: 'booking-1' });

    await markCsaIssued({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'CSA document issued by senior' });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ csaIssued: true, csaIssuedAt: expect.any(Date) }) }));

    await markDepositPaid({ bookingId: 'booking-1', submissionId: 'sub-1', actorId: 'staff-1', actorRole: 'staff', reason: 'Deposit receipt verified internally' });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ depositPaid: true, depositPaidAt: expect.any(Date) }) }));
  });
});

describe('consultation KPI service', () => {
  it('calculates weekly capacity and remaining capacity', async () => {
    groupByMock.mockResolvedValue([
      { assignedSeniorStaffId: 'senior-1', _count: { _all: 10 } },
      { assignedSeniorStaffId: 'senior-2', _count: { _all: 8 } },
    ]);
    countMock.mockResolvedValue(12);

    const target = await getWeeklyCapacityTarget(new Date('2026-05-18T00:00:00.000Z'));
    const remaining = await getRemainingWeeklyCapacity(new Date('2026-05-18T00:00:00.000Z'));

    expect(target).toBe(50);
    expect(remaining).toBe(38);
  });

  it('calculates conversion KPIs', async () => {
    countMock.mockResolvedValueOnce(8).mockResolvedValueOnce(4);
    const completedToCsa = await getCompletedToCsaIssuedConversion(new Date('2026-05-18T00:00:00.000Z'));
    expect(completedToCsa).toEqual({ completed: 8, csaIssued: 4, conversionRate: 0.5 });

    countMock.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    const csaToDeposit = await getCsaIssuedToDepositPaidConversion(new Date('2026-05-18T00:00:00.000Z'));
    expect(csaToDeposit).toEqual({ csaIssued: 10, depositPaid: 3, conversionRate: 0.3 });
  });
});
