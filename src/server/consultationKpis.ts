import { db } from './db';

/**
 * Internal operational KPI tracking for staff planning.
 * No client outcome is sent from KPI queries.
 * Calendar and payment integrations are intentionally left for future phases.
 */

const WEEKLY_CAPACITY_PER_SENIOR = 25;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date) {
  const dayStart = startOfUtcDay(date);
  const day = dayStart.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  dayStart.setUTCDate(dayStart.getUTCDate() - offset);
  return dayStart;
}

export async function getConsultsBookedToday(now = new Date()) {
  const start = startOfUtcDay(now);
  return db.consultationBooking.count({ where: { bookedAt: { gte: start } } });
}

export async function getConsultsBookedThisWeek(now = new Date()) {
  const start = startOfUtcWeek(now);
  return db.consultationBooking.count({ where: { bookedAt: { gte: start } } });
}

export async function getConsultsCompletedThisWeek(now = new Date()) {
  const start = startOfUtcWeek(now);
  return db.consultationBooking.count({ where: { completedAt: { gte: start }, status: 'completed' } });
}

export async function getNoShowsThisWeek(now = new Date()) {
  const start = startOfUtcWeek(now);
  return db.consultationBooking.count({ where: { noShowAt: { gte: start }, status: 'no_show' } });
}

export async function getCancellationsThisWeek(now = new Date()) {
  const start = startOfUtcWeek(now);
  return db.consultationBooking.count({ where: { cancelledAt: { gte: start }, status: 'cancelled' } });
}

export async function getConsultsPerSeniorStaffMember(now = new Date()) {
  const start = startOfUtcWeek(now);
  const grouped = await db.consultationBooking.groupBy({
    by: ['assignedSeniorStaffId'],
    where: { bookedAt: { gte: start }, assignedSeniorStaffId: { not: null } },
    _count: { _all: true },
  });

  return grouped.map((row) => ({ seniorStaffId: row.assignedSeniorStaffId!, bookedCount: row._count._all }));
}

export async function getWeeklyCapacityTarget(now = new Date()) {
  const perStaff = await getConsultsPerSeniorStaffMember(now);
  const seniorCount = perStaff.length;
  return seniorCount * WEEKLY_CAPACITY_PER_SENIOR;
}

export async function getRemainingWeeklyCapacity(now = new Date()) {
  const [target, booked] = await Promise.all([getWeeklyCapacityTarget(now), getConsultsBookedThisWeek(now)]);
  return Math.max(target - booked, 0);
}

export async function getCompletedToCsaIssuedConversion(now = new Date()) {
  const start = startOfUtcWeek(now);
  const [completed, csaIssued] = await Promise.all([
    db.consultationBooking.count({ where: { completedAt: { gte: start }, status: 'completed' } }),
    db.consultationBooking.count({ where: { csaIssuedAt: { gte: start }, csaIssued: true } }),
  ]);

  return {
    completed,
    csaIssued,
    conversionRate: completed === 0 ? 0 : csaIssued / completed,
  };
}

export async function getCsaIssuedToDepositPaidConversion(now = new Date()) {
  const start = startOfUtcWeek(now);
  const [issued, deposits] = await Promise.all([
    db.consultationBooking.count({ where: { csaIssuedAt: { gte: start }, csaIssued: true } }),
    db.consultationBooking.count({ where: { depositPaidAt: { gte: start }, depositPaid: true } }),
  ]);

  return {
    csaIssued: issued,
    depositPaid: deposits,
    conversionRate: issued === 0 ? 0 : deposits / issued,
  };
}
