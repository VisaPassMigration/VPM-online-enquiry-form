type IntakeStatus =
  | 'Awaiting review'
  | 'Under staff review'
  | 'More information requested'
  | 'Risk escalated'
  | 'Progressing to consultation'
  | 'Not progressing';

type RiskLevel = 'No risk disclosed' | 'Risk disclosed' | 'Escalation required';

type SubmissionRecord = {
  clientName: string;
  submittedDate: string;
  country: string;
  nationality: string;
  occupation: string;
  estimatedPoints: number;
  riskLevel: RiskLevel;
  status: IntakeStatus;
  lastUpdated: string;
  nextAction: string;
  assignedReviewer: string;
};

const sampleSubmissions: SubmissionRecord[] = [
  {
    clientName: 'Aisha Khan',
    submittedDate: '2026-05-18T08:35:00Z',
    country: 'United Arab Emirates',
    nationality: 'Pakistani',
    occupation: 'Civil Engineer',
    estimatedPoints: 77,
    riskLevel: 'No risk disclosed',
    status: 'Awaiting review',
    lastUpdated: '2026-05-18T08:35:00Z',
    nextAction: 'Assign reviewer',
    assignedReviewer: 'Unassigned'
  },
  {
    clientName: 'Mateo Alvarez',
    submittedDate: '2026-05-18T03:10:00Z',
    country: 'Chile',
    nationality: 'Chilean',
    occupation: 'ICT Business Analyst',
    estimatedPoints: 71,
    riskLevel: 'Risk disclosed',
    status: 'Under staff review',
    lastUpdated: '2026-05-18T11:50:00Z',
    nextAction: 'Complete risk notes',
    assignedReviewer: 'Priya N.'
  },
  {
    clientName: 'Zoe Martin',
    submittedDate: '2026-05-17T14:22:00Z',
    country: 'United Kingdom',
    nationality: 'British',
    occupation: 'Registered Nurse',
    estimatedPoints: 83,
    riskLevel: 'No risk disclosed',
    status: 'Progressing to consultation',
    lastUpdated: '2026-05-18T07:00:00Z',
    nextAction: 'Book consult slot',
    assignedReviewer: 'Noah S.'
  },
  {
    clientName: 'Rahul Iyer',
    submittedDate: '2026-05-16T20:05:00Z',
    country: 'India',
    nationality: 'Indian',
    occupation: 'Chef',
    estimatedPoints: 62,
    riskLevel: 'Escalation required',
    status: 'Risk escalated',
    lastUpdated: '2026-05-17T09:40:00Z',
    nextAction: 'Senior review',
    assignedReviewer: 'Amelia T.'
  },
  {
    clientName: 'Carla Moreno',
    submittedDate: '2026-05-15T10:00:00Z',
    country: 'Mexico',
    nationality: 'Mexican',
    occupation: 'Marketing Specialist',
    estimatedPoints: 58,
    riskLevel: 'Risk disclosed',
    status: 'More information requested',
    lastUpdated: '2026-05-17T13:15:00Z',
    nextAction: 'Await applicant documents',
    assignedReviewer: 'Priya N.'
  },
  {
    clientName: 'Nadia Petrova',
    submittedDate: '2026-05-14T05:45:00Z',
    country: 'Turkey',
    nationality: 'Russian',
    occupation: 'Accountant',
    estimatedPoints: 49,
    riskLevel: 'No risk disclosed',
    status: 'Not progressing',
    lastUpdated: '2026-05-17T06:30:00Z',
    nextAction: 'Finalise internal notes',
    assignedReviewer: 'Noah S.'
  }
];

const displayDate = (dateTime: string) =>
  new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(
    new Date(dateTime)
  );

const isTodayUtc = (dateTime: string) => {
  const today = new Date();
  const d = new Date(dateTime);
  return (
    d.getUTCFullYear() === today.getUTCFullYear() &&
    d.getUTCMonth() === today.getUTCMonth() &&
    d.getUTCDate() === today.getUTCDate()
  );
};

const statusCount = (status: IntakeStatus) =>
  sampleSubmissions.filter((submission) => submission.status === status).length;

const kpis = [
  { label: 'Total submitted enquiries', value: sampleSubmissions.length },
  { label: 'New enquiries today', value: sampleSubmissions.filter((submission) => isTodayUtc(submission.submittedDate)).length },
  { label: 'Awaiting review', value: statusCount('Awaiting review') },
  { label: 'Under staff review', value: statusCount('Under staff review') },
  { label: 'More information requested', value: statusCount('More information requested') },
  { label: 'Risk escalated', value: statusCount('Risk escalated') },
  { label: 'Progressing to consultation', value: statusCount('Progressing to consultation') },
  { label: 'Not progressing', value: statusCount('Not progressing') },
  { label: 'Average time from submission to first review', value: 'Placeholder' },
  { label: 'Consultation conversion', value: 'Placeholder' }
];

export default function DashboardPage() {
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
          <span className="pill pill--placeholder">Sample data placeholder</span>
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
          <span className="pill pill--placeholder">Sample data placeholder</span>
        </div>
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
              {sampleSubmissions.map((submission) => (
                <tr key={`${submission.clientName}-${submission.submittedDate}`}>
                  <td>{submission.clientName}</td>
                  <td>{displayDate(submission.submittedDate)}</td>
                  <td>{submission.country}</td>
                  <td>{submission.nationality}</td>
                  <td>{submission.occupation}</td>
                  <td>{submission.estimatedPoints}</td>
                  <td>
                    <span
                      className={`pill ${
                        submission.riskLevel === 'No risk disclosed'
                          ? 'pill--ok'
                          : submission.riskLevel === 'Risk disclosed'
                            ? 'pill--warning'
                            : 'pill--danger'
                      }`}
                    >
                      {submission.riskLevel}
                    </span>
                  </td>
                  <td>{submission.status}</td>
                  <td>{displayDate(submission.lastUpdated)}</td>
                  <td>{submission.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
