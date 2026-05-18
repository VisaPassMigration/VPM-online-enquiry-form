import { Prisma, RiskSeverity, RiskResolutionStatus, SubmissionStatus } from '@prisma/client';

import { db } from '@/server/db';

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
  nextAction: string;
};

type IntakePayload = Prisma.JsonObject & {
  firstName?: string;
  lastName?: string;
  countryOfResidence?: string;
  nationality?: string;
  currentOccupation?: string;
};

const displayDate = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(dateTime);

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

const nextActionFor = (status: DashboardStatus) => {
  switch (status) {
    case 'Awaiting review':
      return 'Assign reviewer';
    case 'Under staff review':
      return 'Continue staff assessment';
    case 'More information requested':
      return 'Await client documents';
    case 'Risk escalated':
      return 'Senior risk review required';
    case 'Progressing to consultation':
      return 'Prepare for consultation';
    case 'Not progressing':
      return 'Internal closure checks';
  }
};

const getPayloadField = (payload: Prisma.JsonValue, key: keyof IntakePayload): string => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Not provided';
  const value = (payload as IntakePayload)[key];
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
};

export default async function DashboardPage() {
  const submittedIntakes = await db.intakeSubmission.findMany({
    where: { submittedAt: { not: null } },
    include: {
      pointsSnapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
      riskFlags: { where: { resolutionStatus: { in: [RiskResolutionStatus.open, RiskResolutionStatus.under_review] } } },
      currentReviewState: true,
    },
    orderBy: { submittedAt: 'desc' },
  });

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
      nextAction: nextActionFor(status),
    };
  });

  const countByStatus = (status: DashboardStatus) => rows.filter((row) => row.status === status).length;

  const kpis = [
    { label: 'Total submitted enquiries', value: rows.length },
    { label: 'New enquiries today', value: rows.filter((row) => isTodayUtc(row.submittedDate)).length },
    { label: 'Awaiting review', value: countByStatus('Awaiting review') },
    { label: 'Under staff review', value: countByStatus('Under staff review') },
    { label: 'More information requested', value: countByStatus('More information requested') },
    { label: 'Risk escalated', value: countByStatus('Risk escalated') },
    { label: 'Progressing to consultation', value: countByStatus('Progressing to consultation') },
    { label: 'Not progressing', value: countByStatus('Not progressing') },
    { label: 'Average time from submission to first review', value: 'Placeholder' },
    { label: 'Consultation conversion', value: 'Placeholder' },
  ];

  return (
    <>
      <section className="hero">
        <h1>Staff Dashboard Overview</h1>
        <p>Internal management view for intake enquiries and workflow progression.</p>
      </section>

      <section className="section dashboard-note" role="note" aria-label="Internal dashboard note">
        <strong>Important:</strong> This dashboard is for internal preliminary review and workflow tracking only. No client
        outcome should be released without human review.
      </section>

      <section className="section">
        <div className="section-heading-row">
          <h3>Intake KPI snapshot</h3>
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

      <section className="section">
        <div className="section-heading-row">
          <h3>Filters (placeholder)</h3>
        </div>
        <div className="dashboard-filters">
          {['Status', 'Risk flag', 'Country', 'Date submitted', 'Assigned reviewer'].map((filterName) => (
            <label className="field" key={filterName}>
              <span>{filterName}</span>
              <select defaultValue="">
                <option value="">All {filterName.toLowerCase()}</option>
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading-row">
          <h3>Submitted enquiries</h3>
        </div>
        {rows.length === 0 ? (
          <div className="card">
            <p>No submitted enquiries yet.</p>
            <p>Once clients submit intake forms, they will appear here for mandatory staff review.</p>
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
                  <th>Last updated</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.clientName}</td>
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
                    <td>{displayDate(submission.lastUpdated)}</td>
                    <td>{submission.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
