import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, updateMock, auditCreateMock, countMock, groupByMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  auditCreateMock: vi.fn(),
  countMock: vi.fn(),
  groupByMock: vi.fn(),
}));

vi.mock('../db', () => {
  const tx = {
    consultationBooking: { create: createMock, update: updateMock },
    auditEvent: { create: auditCreateMock },
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
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'consultation_invited' }) }));
  });

  it('updates statuses with timestamps and creates status audit events', async () => {
    updateMock.mockResolvedValue({ id: 'booking-1' });
    const base = {
      bookingId: 'booking-1',
      submissionId: 'sub-1',
      actorId: 'staff-1',
      actorRole: 'staff',
      reason: 'staff update',
    };

    await markConsultationBooked(base);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'booked', bookedAt: expect.any(Date) }) }));

    await markConsultationCompleted(base);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'completed', completedAt: expect.any(Date) }) }));

    await markConsultationNoShow(base);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'no_show', noShowAt: expect.any(Date) }) }));

    await markConsultationCancelled(base);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled', cancelledAt: expect.any(Date) }) }));

    await markConsultationRescheduled(base);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'rescheduled', rescheduledAt: expect.any(Date) }) }));

    const auditEventTypes = auditCreateMock.mock.calls.map((call) => call[0].data.eventType);
    expect(auditEventTypes).toEqual(
      expect.arrayContaining(['consultation_booked', 'consultation_completed', 'consultation_no_show', 'consultation_cancelled', 'consultation_rescheduled']),
    );
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
