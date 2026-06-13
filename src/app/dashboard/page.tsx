import React from 'react';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';
import Link from 'next/link';
import { LeadRating, Prisma, RiskSeverity, RiskResolutionStatus, SubmissionStatus } from '@prisma/client';

import { db } from '@/server/db';
import {

  getCancellationsThisWeek,
  getCompletedToCsaIssuedConversion,
  getConsultsBookedThisWeek,
  getConsultsBookedToday,
  getConsultsCompletedThisWeek,
  getCsaIssuedToDepositPaidConversion,
  getNoShowsThisWeek,
  getRemainingWeeklyCapacity,
  getSeniorStaffCapacityRows,
  getUpcomingConsultations,
} from '@/server/consultationKpis';
import { auth } from '@/auth';

export const dynamic = "force-dynamic";

type DashboardStatus =
  | 'Awaiting review'
  | 'Under staff review'
  | 'More information requested'
  | 'Risk escalated'
  | 'Progressing to consultation'
  | 'Not progressing';

type DashboardRow = {
  id: string;
  clientName: string;
  submittedDate: Date;
  country: string;
  nationality: string;
  occupation: string;
  estimatedPoints: number | null;
  riskFlags: string[];
  status: DashboardStatus;
  lastUpdated: Date;
  leadRating: LeadRating | null;
  leadRatingReason: string | null;
};
type LeadRatingFilter = 'all' | LeadRating | 'not_rated';
type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';
type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
type TaskDueScopeFilter = 'all' | 'overdue' | 'due_today' | 'due_this_week' | 'no_due_date';
type TaskAssigneeFilter = 'all' | 'unassigned' | string;
type TaskViewFilter = 'all' | 'my';
type StaffTaskRow = {
  id: string;
  title: string;
  taskType: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  assignedStaff: string;
  assignedStaffUserId: string | null;
  submissionId: string | null;
  clientName: string;
  leadRating: LeadRating | null;
  createdAt: Date;
};

const leadRatingFilters: ReadonlyArray<LeadRatingFilter> = ['all', 'hot', 'warm', 'cold', 'escalate', 'not_rated'];
const taskStatusFilters = ['all', 'open', 'in_progress', 'completed', 'cancelled'] as const;
const taskPriorityFilters = ['all', 'low', 'normal', 'high', 'urgent'] as const;
const taskDueScopeFilters = ['all', 'overdue', 'due_today', 'due_this_week', 'no_due_date'] as const;

const isLeadRatingFilter = (value: string): value is LeadRatingFilter =>
  leadRatingFilters.includes(value as LeadRatingFilter);

const parseLeadRatingFilter = (value: string | string[] | undefined): LeadRatingFilter => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return 'all';
  return isLeadRatingFilter(normalized) ? normalized : 'all';
};
const parseListFilter = <T extends readonly string[]>(value: string | string[] | undefined, allowed: T): T[number] => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return allowed[0];
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T[number]) : allowed[0];
};
const parseTaskAssigneeFilter = (value: string | string[] | undefined): TaskAssigneeFilter => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return 'all';
  if (normalized === 'all' || normalized === 'unassigned') return normalized;
  return normalized;
};
const parseTaskViewFilter = (value: string | string[] | undefined): TaskViewFilter => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return 'all';
  return normalized === 'my' ? 'my' : 'all';
};

const leadRatingFilterSummary = (filter: LeadRatingFilter) =>
  filter === 'all' ? 'All lead ratings' : filter === 'not_rated' ? 'Not rated only' : `${leadRatingLabel(filter)} only`;
const leadRatingLabel = (rating: LeadRating | null) => rating ? rating[0].toUpperCase() + rating.slice(1) : 'Not rated';
const leadRatingPillClass = (rating: LeadRating | null) =>
  rating === 'hot' ? 'pill--danger'
    : rating === 'warm' ? 'pill--warning'
      : rating === 'cold' ? 'pill--placeholder'
        : rating === 'escalate' ? 'pill--danger'
          : 'pill--placeholder';
const triagePriority: Record<LeadRatingFilter, number> = {
  all: 99,
  escalate: 0,
  hot: 1,
  warm: 2,
  not_rated: 3,
  cold: 4,
};
const nextActionHintFor = (rating: LeadRating | null) => {
  if (rating === 'escalate') return 'Senior risk review required';
  if (rating === 'hot') return 'Prioritise review / consultation pathway review';
  if (rating === 'warm') return 'Check missing info or documents';
  if (rating === 'cold') return 'Low priority review / confirm hold if appropriate';
  return 'Generate/confirm rating';
};
const leadRatingReasonPreview = (reason: string | null) =>
  reason && reason.trim() ? reason.trim().slice(0, 80) : '—';
const HIGH_ESTIMATED_POINTS_THRESHOLD = 80;
const utcDayBounds = (source: Date) => {
  const start = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};
const isOverdue = (dueDate: Date | null, now: Date) => Boolean(dueDate && dueDate.getTime() < utcDayBounds(now).start.getTime());
const isDueToday = (dueDate: Date | null, now: Date) => {
  if (!dueDate) return false;
  const { start, end } = utcDayBounds(now);
  return dueDate >= start && dueDate < end;
};
const isDueThisWeek = (dueDate: Date | null, now: Date) => {
  if (!dueDate) return false;
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return dueDate >= weekStart && dueDate < weekEnd;
};
const priorityRank: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
type StaffTaskDelegate = { findMany: (args: object) => Promise<Array<Record<string, unknown>>> };

const hasStaffTaskDelegate = (client: unknown): client is { staffTask: StaffTaskDelegate } => {
  const staffTask = (client as { staffTask?: unknown }).staffTask;
  return Boolean(
    staffTask &&
    typeof staffTask === 'object' &&
    typeof (staffTask as { findMany?: unknown }).findMany === 'function',
  );
};

type IntakePayload = Prisma.JsonObject & {
  firstName?: string;
  lastName?: string;
  countryOfResidence?: string;
  nationality?: string;
  currentOccupation?: string;
};

const displayDate = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Perth',
  }).format(dateTime).replace(/\s(am|pm)$/i, (match) => match.toUpperCase());

const isTodayUtc = (dateTime: Date) => {
  const today = new Date();
  return (
    dateTime.getUTCFullYear() === today.getUTCFullYear() &&
    dateTime.getUTCMonth() === today.getUTCMonth() &&
    dateTime.getUTCDate() === today.getUTCDate()
  );
};

const formatRiskFlag = (code: string, severity: RiskSeverity) => `${code.replaceAll('_', ' ')} (${severity})`;

const hasEscalatedRisk = (severities: RiskSeverity[]) => severities.some((severity) => severity === 'high' || severity === 'critical');

const mapStatus = (submissionStatus: SubmissionStatus, escalatedRisk: boolean): DashboardStatus => {
  if (escalatedRisk) return 'Risk escalated';

  if (submissionStatus === 'submitted') return 'Awaiting review';
  if (submissionStatus === 'awaiting_client_documents') return 'More information requested';
  if (submissionStatus === 'ready_for_client_summary') return 'Progressing to consultation';
  if (submissionStatus === 'on_hold' || submissionStatus === 'closed' || submissionStatus === 'client_summary_sent') {
    return 'Not progressing';
  }

  return 'Under staff review';
};

const getPayloadField = (payload: Prisma.JsonValue, key: keyof IntakePayload): string => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Not provided';
  const value = (payload as IntakePayload)[key];
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.VIEW_DASHBOARD);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const leadRatingFilter = parseLeadRatingFilter(resolvedSearchParams.leadRating);
  const taskStatusFilter = parseListFilter(resolvedSearchParams.taskStatus, taskStatusFilters);
  const taskPriorityFilter = parseListFilter(resolvedSearchParams.taskPriority, taskPriorityFilters);
  const taskDueScopeFilter = parseListFilter(resolvedSearchParams.taskDueScope, taskDueScopeFilters);
  const taskTypeFilterRaw = Array.isArray(resolvedSearchParams.taskType) ? resolvedSearchParams.taskType[0] : resolvedSearchParams.taskType;
  const taskTypeFilter = taskTypeFilterRaw?.trim() ? taskTypeFilterRaw : 'all';
  const taskLeadRatingFilter = parseLeadRatingFilter(resolvedSearchParams.taskLeadRating);
  const taskAssigneeFilter = parseTaskAssigneeFilter(resolvedSearchParams.taskAssignee);
  const taskViewFilter = parseTaskViewFilter(resolvedSearchParams.taskView);
  const session = await auth();
  const sessionStaffUserId = session?.user?.staffUserId?.trim() || null;
  const [
    consultsBookedToday,
    consultsBookedThisWeek,
    consultsCompletedThisWeek,
    noShowsThisWeek,
    cancellationsThisWeek,
    remainingWeeklyCapacity,
    completedToCsaIssued,
    csaIssuedToDepositPaid,
    seniorStaffCapacityRows,
    upcomingConsultations,
  ] = await Promise.all([
    getConsultsBookedToday(),
    getConsultsBookedThisWeek(),
    getConsultsCompletedThisWeek(),
    getNoShowsThisWeek(),
    getCancellationsThisWeek(),
    getRemainingWeeklyCapacity(),
    getCompletedToCsaIssuedConversion(),
    getCsaIssuedToDepositPaidConversion(),
    getSeniorStaffCapacityRows(),
    getUpcomingConsultations(),
  ]);

  const submittedIntakes = await db.intakeSubmission.findMany({
    where: { submittedAt: { not: null } },
    include: {
      pointsSnapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
      riskFlags: { where: { resolutionStatus: { in: [RiskResolutionStatus.open, RiskResolutionStatus.under_review] } } },
      currentReviewState: true,
    },
    orderBy: { submittedAt: 'desc' },
  });
  const rawStaffTasks = hasStaffTaskDelegate(db)
    ? await db.staffTask.findMany({
        include: { submission: { select: { id: true, payload: true, leadRating: true } } },
      })
    : [];

  const rows: DashboardRow[] = submittedIntakes.map((submission) => {
    const payload = submission.payload;
    const firstName = getPayloadField(payload, 'firstName');
    const lastName = getPayloadField(payload, 'lastName');
    const clientName = `${firstName} ${lastName}`.replace('Not provided Not provided', 'Not provided').trim();
    const activeRiskSeverities = submission.riskFlags.map((flag) => flag.severity);
    const escalatedRisk = hasEscalatedRisk(activeRiskSeverities);
    const status = mapStatus(submission.status, escalatedRisk);

    return {
      id: submission.id,
      clientName,
      submittedDate: submission.submittedAt ?? submission.createdAt,
      country: getPayloadField(payload, 'countryOfResidence'),
      nationality: getPayloadField(payload, 'nationality'),
      occupation: getPayloadField(payload, 'currentOccupation'),
      estimatedPoints: submission.pointsSnapshots[0]?.totalPoints ?? null,
      riskFlags: submission.riskFlags.map((flag) => formatRiskFlag(flag.riskCode, flag.severity)),
      status,
      lastUpdated: submission.currentReviewState?.updatedAt ?? submission.updatedAt,
      leadRating: submission.leadRating,
      leadRatingReason: submission.leadRatingReason,
    };
  });

  const countByStatus = (status: DashboardStatus) => rows.filter((row) => row.status === status).length;
  const newRegistrationsToday = rows.filter((row) => isTodayUtc(row.submittedDate)).length;
  const awaitingReviewCount = countByStatus('Awaiting review');
  const riskEscalatedCount = countByStatus('Risk escalated');
  const notRatedCount = rows.filter((row) => row.leadRating === null).length;
  const highEstimatedPointsCount = rows.filter((row) => (row.estimatedPoints ?? 0) >= HIGH_ESTIMATED_POINTS_THRESHOLD).length;
  const filteredRows = rows
    .filter((row) => {
      if (leadRatingFilter === 'all') return true;
      if (leadRatingFilter === 'not_rated') return row.leadRating === null;
      return row.leadRating === leadRatingFilter;
    })
    .sort((a, b) => {
      const aPriority = triagePriority[a.leadRating ?? 'not_rated'];
      const bPriority = triagePriority[b.leadRating ?? 'not_rated'];
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.submittedDate.getTime() - a.submittedDate.getTime();
    });

  const kpis = [
    { label: 'Total submitted enquiries', value: rows.length },
    { label: 'New enquiries today', value: newRegistrationsToday },
    { label: 'Awaiting review', value: awaitingReviewCount },
    { label: 'Under staff review', value: countByStatus('Under staff review') },
    { label: 'More information requested', value: countByStatus('More information requested') },
    { label: 'Risk escalated', value: riskEscalatedCount },
    { label: 'Progressing to consultation', value: countByStatus('Progressing to consultation') },
    { label: 'Not progressing', value: countByStatus('Not progressing') },
    { label: 'Hot leads', value: rows.filter((row) => row.leadRating === 'hot').length },
    { label: 'Warm leads', value: rows.filter((row) => row.leadRating === 'warm').length },
    { label: 'Cold leads', value: rows.filter((row) => row.leadRating === 'cold').length },
    { label: 'Escalate leads', value: rows.filter((row) => row.leadRating === 'escalate').length },
    { label: 'Not Rated leads', value: notRatedCount },
    { label: 'Average time from submission to first review', value: 'Not enough data yet' },
    { label: 'Consultation conversion', value: 'No conversion data yet' },
  ];
  const staffTasks = rawStaffTasks.map((task) => {
    const submission = (task.submission ?? null) as ({ id: string; payload: Prisma.JsonValue; leadRating: LeadRating | null } | null);
    return {
      id: String(task.id),
      title: String(task.title),
      taskType: String(task.taskType),
      priority: ((task.priority as string) === 'medium' ? 'normal' : task.priority) as TaskPriority,
      status: ((task.status as string) === 'blocked' ? 'in_progress' : task.status) as TaskStatus,
      dueDate: (task.dueDate as Date | null) ?? null,
      assignedStaff: String(task.assignedStaffName ?? 'Unassigned'),
      assignedStaffUserId: task.assignedStaffUserId ? String(task.assignedStaffUserId) : null,
      submissionId: submission?.id ?? null,
      clientName: submission ? `${getPayloadField(submission.payload, 'firstName')} ${getPayloadField(submission.payload, 'lastName')}`.trim() : 'Not linked',
      leadRating: submission?.leadRating ?? null,
      createdAt: task.createdAt as Date,
    } satisfies StaffTaskRow;
  });
  const now = new Date();
  const openTasks = staffTasks.filter((task) => task.status === 'open' || task.status === 'in_progress');
  const myOpenTasks = sessionStaffUserId ? openTasks.filter((task) => task.assignedStaffUserId === sessionStaffUserId) : [];
  const unassignedOpenTasks = openTasks.filter((task) => task.assignedStaff === 'Unassigned').length;
  const workloadRows = Array.from(new Set(staffTasks.filter((task) => task.assignedStaff !== 'Unassigned').map((task) => task.assignedStaff)))
    .sort((a, b) => a.localeCompare(b))
    .map((staffName) => {
      const assigned = staffTasks.filter((task) => task.assignedStaff === staffName);
      const assignedOpen = assigned.filter((task) => task.status === 'open' || task.status === 'in_progress');
      return {
        staffName,
        open: assignedOpen.filter((task) => task.status === 'open').length,
        inProgress: assignedOpen.filter((task) => task.status === 'in_progress').length,
        overdue: assignedOpen.filter((task) => isOverdue(task.dueDate, now)).length,
        urgentOrHigh: assignedOpen.filter((task) => task.priority === 'urgent' || task.priority === 'high').length,
        dueToday: assignedOpen.filter((task) => isDueToday(task.dueDate, now)).length,
        dueThisWeek: assignedOpen.filter((task) => isDueThisWeek(task.dueDate, now)).length,
        hotLead: assignedOpen.filter((task) => task.leadRating === 'hot').length,
        escalateLead: assignedOpen.filter((task) => task.leadRating === 'escalate').length,
      };
    });
  const availableTaskTypes = Array.from(new Set(staffTasks.map((task) => task.taskType))).sort((a, b) => a.localeCompare(b));
  const availableAssignees = Array.from(new Set(staffTasks.map((task) => task.assignedStaff).filter((name) => name !== 'Unassigned'))).sort((a, b) => a.localeCompare(b));
  const filteredTasks = staffTasks.filter((task) => {
    if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false;
    if (taskPriorityFilter !== 'all' && task.priority !== taskPriorityFilter) return false;
    if (taskDueScopeFilter === 'overdue' && !isOverdue(task.dueDate, now)) return false;
    if (taskDueScopeFilter === 'due_today' && !isDueToday(task.dueDate, now)) return false;
    if (taskDueScopeFilter === 'due_this_week' && !isDueThisWeek(task.dueDate, now)) return false;
    if (taskDueScopeFilter === 'no_due_date' && task.dueDate) return false;
    if (taskTypeFilter !== 'all' && task.taskType !== taskTypeFilter) return false;
    if (taskLeadRatingFilter === 'not_rated' && task.leadRating !== null) return false;
    if (taskLeadRatingFilter !== 'all' && taskLeadRatingFilter !== 'not_rated' && task.leadRating !== taskLeadRatingFilter) return false;
    if (taskAssigneeFilter === 'unassigned' && task.assignedStaff !== 'Unassigned') return false;
    if (taskAssigneeFilter !== 'all' && taskAssigneeFilter !== 'unassigned' && task.assignedStaff !== taskAssigneeFilter) return false;
    if (taskViewFilter === 'my' && sessionStaffUserId && task.assignedStaffUserId !== sessionStaffUserId) return false;
    return true;
  });
  const sortedFilteredTasks = [...filteredTasks].sort((a, b) => {
    const overdueDelta = Number(isOverdue(b.dueDate, now)) - Number(isOverdue(a.dueDate, now));
    if (overdueDelta !== 0) return overdueDelta;
    const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const taskFilterGroups = [
    { key: 'taskView', label: 'View', active: taskViewFilter, values: ['all', 'my'] },
    { key: 'taskStatus', label: 'Status', active: taskStatusFilter, values: taskStatusFilters },
    { key: 'taskPriority', label: 'Priority', active: taskPriorityFilter, values: taskPriorityFilters },
    { key: 'taskDueScope', label: 'Due', active: taskDueScopeFilter, values: taskDueScopeFilters },
    { key: 'taskType', label: 'Type', active: taskTypeFilter, values: ['all', ...availableTaskTypes] },
    { key: 'taskLeadRating', label: 'Lead rating', active: taskLeadRatingFilter, values: leadRatingFilters },
    { key: 'taskAssignee', label: 'Assignee', active: taskAssigneeFilter, values: ['all', 'unassigned', ...availableAssignees] },
  ];

  return (
    <>
      <section className="staff-hero" id="dashboard-top">
        <div>
          <p className="eyebrow">Staff workspace</p>
          <h1>Staff Dashboard Overview</h1>
          <p>Internal management view for intake enquiries, workflow progression, staff tasks, and consultation capacity.</p>
        </div>
        <Link href="/dashboard/enquiries" className="primary-btn">Go to Enquiries</Link>
      </section>

      <section className="callout-grid" aria-label="Dashboard operating notes">
        <article className="callout-card callout-card--info" role="note" aria-label="Internal dashboard note">
          <strong>Important:</strong>
          <p>This dashboard is for internal preliminary review and workflow tracking only. No client outcome should be released without human review.</p>
        </article>
        <article className="callout-card callout-card--info" role="note" aria-label="Consultation KPI tracking note">
          <strong>Consultation KPI tracking</strong>
          <p>Consultation KPIs are for internal operations tracking only. Status and outcome updates remain staff-controlled.</p>
        </article>
      </section>

      <section className="section staff-section review-brief" aria-labelledby="staff-review-brief-heading">
        <div className="section-heading-row section-heading-row--stacked">
          <div>
            <p className="eyebrow">Today’s activity</p>
            <h3 id="staff-review-brief-heading">Staff Review Brief</h3>
          </div>
          <p className="section-helper">Current review priorities for submitted registrations. Use these prompts to jump directly to the review queue and lead rating filters.</p>
        </div>
        <div className="review-brief__summary" aria-label="Current review priorities">
          <article className="card review-brief__item">
            <p>New registrations submitted today</p>
            <strong>{newRegistrationsToday}</strong>
            <span>Today’s activity ready for staff triage.</span>
          </article>
          <article className="card review-brief__item">
            <p>Awaiting VPM review</p>
            <strong>{awaitingReviewCount}</strong>
            <span>Review queue ready.</span>
          </article>
          <article className="card review-brief__item">
            <p>Not yet rated</p>
            <strong>{notRatedCount}</strong>
            <span>Generate or confirm internal lead rating.</span>
          </article>
          <article className="card review-brief__item">
            <p>Risk escalated items</p>
            <strong>{riskEscalatedCount}</strong>
            <span>Open or under-review risk flags requiring senior attention.</span>
          </article>
          <article className="card review-brief__item">
            <p>High estimated points submissions</p>
            <strong>{highEstimatedPointsCount}</strong>
            <span>Latest preliminary points snapshots at {HIGH_ESTIMATED_POINTS_THRESHOLD}+ points, where available.</span>
          </article>
        </div>
        <div className="review-brief__actions" aria-label="Review brief actions">
          <Link href="/dashboard#submitted-enquiries" className="primary-btn">Review submitted registrations</Link>
          <Link href="/dashboard?leadRating=not_rated#lead-rating-filters" className="secondary-btn">View not rated registrations</Link>
          <Link href="/dashboard#submitted-enquiries" className="secondary-btn">View risk escalated items</Link>
        </div>
      </section>

      <section className="section staff-section staff-task-panel" id="staff-task-operations">
        <div className="section-heading-row section-heading-row--stacked">
          <div>
            <p className="eyebrow">Operations</p>
            <h3>Staff Task Operations</h3>
          </div>
          <p className="section-helper">Staff tasks are internal operational reminders. They do not send client communications or create calendar events.</p>
        </div>
        <div className="callout-card callout-card--neutral">
          <strong>Task ownership note</strong>
          <p>Task ownership and workload visibility are for internal operational management only.</p>
        </div>
        <div className="filter-panel" aria-label="Staff task filters">
          <div className="filter-panel__header">
            <p className="active-filter-summary">
              Active filters: status={taskStatusFilter}, priority={taskPriorityFilter}, due={taskDueScopeFilter}, type={taskTypeFilter}, lead
              rating={taskLeadRatingFilter}, assignee={taskAssigneeFilter}, view={taskViewFilter}
            </p>
            <Link href={leadRatingFilter === 'all' ? '/dashboard#staff-task-operations' : `/dashboard?leadRating=${leadRatingFilter}#staff-task-operations`} className="filter-clear">Clear Task Filters</Link>
          </div>
          {taskFilterGroups.map(({ key, label: groupLabel, active, values }) => (
            <div key={String(key)} className="filter-row">
              <span className="filter-row__label">{groupLabel}</span>
              <div className="filter-chip-group">
                {(values as readonly string[]).map((value) => {
                  const params = new URLSearchParams();
                  if (leadRatingFilter !== 'all') params.set('leadRating', leadRatingFilter);
                  const entries: Array<[string, string]> = [
                    ['taskStatus', taskStatusFilter],
                    ['taskPriority', taskPriorityFilter],
                    ['taskDueScope', taskDueScopeFilter],
                    ['taskType', taskTypeFilter],
                    ['taskLeadRating', taskLeadRatingFilter],
                    ['taskAssignee', taskAssigneeFilter],
                    ['taskView', taskViewFilter],
                  ];
                  entries.forEach(([k, v]) => {
                    const nextValue = k === key ? value : v;
                    if (nextValue !== 'all') params.set(k, nextValue);
                  });
                  const href = params.toString() ? `/dashboard?${params.toString()}#staff-task-operations` : '/dashboard#staff-task-operations';
                  const label = value === 'not_rated' ? 'not rated' : value.replaceAll('_', ' ');
                  const isActive = active === value;
                  return <Link key={`${key}-${value}`} href={href} className={isActive ? 'filter-chip filter-chip--active' : 'filter-chip'}>{label}</Link>;
                })}
              </div>
            </div>
          ))}
        </div>
        {taskViewFilter === 'my' && !sessionStaffUserId && (
          <p className="callout-card callout-card--warning">My Tasks view is unavailable because your staff session ID could not be resolved. Showing all tasks for safety.</p>
        )}
        <div className="dashboard-kpi-grid">
          {[
            { label: 'My open tasks', value: myOpenTasks.length },
            { label: 'Unassigned tasks', value: unassignedOpenTasks },
            { label: 'Overdue tasks', value: openTasks.filter((task) => isOverdue(task.dueDate, now)).length },
            { label: 'Due today', value: openTasks.filter((task) => isDueToday(task.dueDate, now)).length },
            { label: 'Due this week', value: openTasks.filter((task) => isDueThisWeek(task.dueDate, now)).length },
            { label: 'Urgent tasks', value: openTasks.filter((task) => task.priority === 'urgent').length },
            { label: 'Tasks linked to Hot leads', value: openTasks.filter((task) => task.leadRating === 'hot').length },
            { label: 'Tasks linked to Escalate leads', value: openTasks.filter((task) => task.leadRating === 'escalate').length },
          ].map((kpi) => <article className="card kpi-card" key={kpi.label}><p>{kpi.label}</p><h4>{kpi.value}</h4></article>)}
        </div>
        <div className="table-wrap">
          <table className="dashboard-table">
            <thead><tr><th>Staff member</th><th>Open tasks</th><th>In-progress tasks</th><th>Overdue tasks</th><th>Urgent/high priority tasks</th><th>Due today</th><th>Due this week</th><th>Hot lead tasks</th><th>Escalate lead tasks</th></tr></thead>
            <tbody>
              {workloadRows.length === 0 ? <tr><td colSpan={9}>No assigned staff workload to display.</td></tr> : workloadRows.map((row) => (
                <tr key={row.staffName}>
                  <td>{row.staffName}</td><td>{row.open}</td><td>{row.inProgress}</td><td>{row.overdue}</td><td>{row.urgentOrHigh}</td><td>{row.dueToday}</td><td>{row.dueThisWeek}</td><td>{row.hotLead}</td><td>{row.escalateLead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table className="dashboard-table">
            <thead><tr><th>Task title</th><th>Task type</th><th>Priority</th><th>Status</th><th>Due date</th><th>Assigned staff</th><th>Linked client/submission</th><th>Lead rating</th></tr></thead>
            <tbody>
              {sortedFilteredTasks.length === 0 ? <tr><td colSpan={8}>No staff tasks match the selected filters.</td></tr> : sortedFilteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}{isOverdue(task.dueDate, now) && ' • OVERDUE'}{isDueToday(task.dueDate, now) && ' • DUE TODAY'}{task.priority === 'urgent' && ' • URGENT'}{task.leadRating === 'hot' && ' • HOT LEAD'}{task.leadRating === 'escalate' && ' • ESCALATE LEAD'}</td>
                  <td>{task.taskType}</td><td>{task.priority}</td><td>{task.status}</td><td>{task.dueDate ? displayDate(task.dueDate) : 'Not set'}</td><td>{task.assignedStaff}</td>
                  <td>{task.submissionId ? `${task.clientName} (${task.submissionId})` : 'Not linked'}</td><td>{leadRatingLabel(task.leadRating)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section staff-section">
        <div className="section-heading-row">
          <div><p className="eyebrow">Pipeline health</p><h3>Intake KPI snapshot</h3></div>
        </div>
        <div className="dashboard-kpi-grid">
          {kpis.map((kpi) => (
            <article className="card kpi-card" key={kpi.label}>
              <p>{kpi.label}</p>
              <h4>{kpi.value}</h4>
            </article>
          ))}
        </div>
      </section>

      <section className="section staff-section">
        <div className="section-heading-row">
          <div><p className="eyebrow">Consultations</p><h3>Consultation KPI snapshot</h3></div>
        </div>
        <div className="dashboard-kpi-grid">
          {[
            { label: 'Consults booked today', value: consultsBookedToday },
            { label: 'Consults booked this week', value: consultsBookedThisWeek },
            { label: 'Consults completed this week', value: consultsCompletedThisWeek },
            { label: 'No-shows this week', value: noShowsThisWeek },
            { label: 'Cancellations this week', value: cancellationsThisWeek },
            { label: 'Remaining weekly capacity', value: remainingWeeklyCapacity },
            {
              label: 'Completed → CSA issued conversion',
              value: `${Math.round(completedToCsaIssued.conversionRate * 100)}% (${completedToCsaIssued.csaIssued}/${completedToCsaIssued.completed})`,
            },
            {
              label: 'CSA issued → deposit paid conversion',
              value: `${Math.round(csaIssuedToDepositPaid.conversionRate * 100)}% (${csaIssuedToDepositPaid.depositPaid}/${csaIssuedToDepositPaid.csaIssued})`,
            },
          ].map((kpi) => (
            <article className="card kpi-card" key={kpi.label}>
              <p>{kpi.label}</p>
              <h4>{kpi.value}</h4>
            </article>
          ))}
        </div>
      </section>

      <section className="section staff-section">
        <div className="section-heading-row">
          <div><p className="eyebrow">Capacity</p><h3>Senior Staff Capacity</h3></div>
        </div>
        {seniorStaffCapacityRows.length === 0 ? (
          <div className="card">
            <p>No senior staff consultation bookings yet this week.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Senior staff name</th>
                  <th>Booked this week</th>
                  <th>Completed this week</th>
                  <th>Weekly target: 25</th>
                  <th>Remaining capacity</th>
                </tr>
              </thead>
              <tbody>
                {seniorStaffCapacityRows.map((row) => (
                  <tr key={row.seniorStaffName}>
                    <td>{row.seniorStaffName}</td>
                    <td>{row.bookedThisWeek}</td>
                    <td>{row.completedThisWeek}</td>
                    <td>{row.weeklyTarget}</td>
                    <td>{row.remainingCapacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section staff-section">
        <div className="section-heading-row">
          <div><p className="eyebrow">Calendar</p><h3>Upcoming Consultations</h3></div>
        </div>
        {upcomingConsultations.length === 0 ? (
          <div className="card">
            <p>Coming next: live upcoming consultation list will appear here once bookings are available.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Senior staff</th>
                  <th>Date/time (Australia/Perth)</th>
                  <th>Timezone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingConsultations.map((consultation) => (
                  <tr key={consultation.id}>
                    <td>{consultation.clientName}</td>
                    <td>{consultation.assignedSeniorStaffName ?? 'Unassigned'}</td>
                    <td>{consultation.bookingDateTime ? displayDate(consultation.bookingDateTime) : 'Not set'}</td>
                    <td>{consultation.bookingTimezone ?? 'Not set'}</td>
                    <td>{consultation.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section staff-section" id="lead-rating-filters">
        <div className="section-heading-row section-heading-row--stacked">
          <div><p className="eyebrow">Submitted enquiry filters</p><h3>Lead rating filters</h3></div>
          <p className="section-helper">Use these chips to filter the submitted enquiries table below. Links keep staff near this section after filtering.</p>
        </div>
        <div className="submitted-filter-bar" aria-label="Lead rating filter controls">
          <div className="filter-chip-group">
            {leadRatingFilters.map((filterValue) => {
              const href = filterValue === 'all' ? '/dashboard#lead-rating-filters' : `/dashboard?leadRating=${filterValue}#lead-rating-filters`;
              const isActive = leadRatingFilter === filterValue;
              return (
                <Link key={filterValue} href={href} className={isActive ? 'filter-chip filter-chip--active' : 'filter-chip'}>
                  {filterValue === 'all' ? 'All' : filterValue === 'not_rated' ? 'Not rated' : leadRatingLabel(filterValue)}
                </Link>
              );
            })}
          </div>
          <Link href="/dashboard#lead-rating-filters" className="filter-clear">Clear filters</Link>
        </div>
      </section>

      <section className="section staff-section" id="submitted-enquiries">
        <div className="section-heading-row">
          <div><p className="eyebrow">Review queue</p><h3>Submitted enquiries</h3></div>
        </div>
        <p>Active filter: {leadRatingFilterSummary(leadRatingFilter)}</p>
        <p>Lead ratings are internal triage classifications and are not client outcomes.</p>
        <p>Lead rating and next-action hints are internal workflow aids only. They are not client outcomes.</p>
        {filteredRows.length === 0 ? (
          <div className="card">
            <p>No submitted enquiries match the current filter.</p>
            <p>Adjust or clear filters to view more submitted enquiries for internal review.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Client name</th>
                  <th>Submitted date</th>
                  <th>Country of residence</th>
                  <th>Nationality</th>
                  <th>Current occupation</th>
                  <th>Estimated points</th>
                  <th>Risk flags</th>
                  <th>Status</th>
                  <th>Lead Rating</th>
                  <th>Lead Rating Reason</th>
                  <th>Last updated</th>
                  <th>Next Action Hint</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((submission) => (
                  <tr key={submission.id}>
                    <td><div className="review-queue-client-action"><Link href={`/dashboard/intakes/${submission.id}`} className="review-queue-client-link">{submission.clientName}</Link><Link href={`/dashboard/intakes/${submission.id}`} className="secondary-btn review-queue-open-link">Open review</Link></div></td>
                    <td>{displayDate(submission.submittedDate)}</td>
                    <td>{submission.country}</td>
                    <td>{submission.nationality}</td>
                    <td>{submission.occupation}</td>
                    <td>{submission.estimatedPoints ?? 'Not available yet'}</td>
                    <td>
                      {submission.riskFlags.length ? (
                        <ul>
                          {submission.riskFlags.map((flag) => (
                            <li key={flag}>{flag}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="pill pill--ok">No active flags</span>
                      )}
                    </td>
                    <td>{submission.status}</td>
                    <td><span className={`pill ${leadRatingPillClass(submission.leadRating)}`}>{leadRatingLabel(submission.leadRating)}</span></td>
                    <td>{leadRatingReasonPreview(submission.leadRatingReason)}</td>
                    <td>{displayDate(submission.lastUpdated)}</td>
                    <td>{nextActionHintFor(submission.leadRating)}</td>
                    <td><Link href={`/dashboard/intakes/${submission.id}`} className="secondary-btn">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="dashboard-back-to-top" aria-label="Dashboard page navigation">
        <Link href="#dashboard-top" className="secondary-btn">↑ Back to top</Link>
      </div>
    </>
  );
}
