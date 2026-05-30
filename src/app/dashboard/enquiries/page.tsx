import Link from 'next/link';
import { EnquiryCommunicationType } from '@prisma/client';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';
import { db } from '@/server/db';
import { runCreateEnquiryAction, runDraftFaqAction, runSendFaqAction } from './actions';

export const dynamic = "force-dynamic";

const TEMPLATE_OPTIONS: Array<{ value: EnquiryCommunicationType; label: string }> = [
  { value: 'faq_general_migration', label: 'General migration enquiry' },
  { value: 'faq_skilled_migration', label: 'Skilled migration enquiry' },
  { value: 'faq_student_visa', label: 'Student visa enquiry' },
  { value: 'faq_partner_family', label: 'Partner/family enquiry' },
  { value: 'faq_employer_sponsored', label: 'Employer-sponsored enquiry' },
  { value: 'faq_insufficient_information', label: 'Not enough information / please complete questionnaire' },
];

const formatStaffDate = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Perth',
  }).format(dateTime).replace(/\s(am|pm)$/i, (match) => match.toUpperCase());

const statusPillClass = (status: string | undefined) => {
  if (!status) return 'pill pill--placeholder';
  if (status.includes('sent') || status.includes('linked') || status === 'submitted') return 'pill pill--ok';
  if (status.includes('failed')) return 'pill pill--danger';
  return 'pill pill--warning';
};

export default async function EnquiriesPage() {
  await requirePermission(PERMISSIONS.VIEW_DASHBOARD);
  const enquiries = await db.enquiry.findMany({
    include: {
      intakeSubmission: { select: { id: true, status: true } },
      communications: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="staff-page">
      <section className="staff-hero">
        <div>
          <p className="eyebrow">Staff workspace</p>
          <h1>Enquiries</h1>
          <p>
            Capture early leads, prepare FAQ/pre-intake emails, and track intake link status before a full intake submission is created.
          </p>
        </div>
        <Link href="/dashboard" className="secondary-btn">Back to dashboard</Link>
      </section>

      <section className="callout-grid" aria-label="Enquiry operating notes">
        <article className="callout-card callout-card--info">
          <strong>FAQ / Pre-Intake emails are staff-controlled information emails only.</strong>
          <p>They do not confirm any migration outcome or send consultation links.</p>
        </article>
        {!process.env.NEXT_PUBLIC_INTAKE_FORM_URL ? (
          <article className="callout-card callout-card--warning">
            <strong>Intake link configuration:</strong>
            <p>NEXT_PUBLIC_INTAKE_FORM_URL not set. Placeholder [INTAKE_FORM_LINK] is used in drafts until configured.</p>
          </article>
        ) : null}
      </section>

      <section className="section staff-section">
        <div className="section-heading-row section-heading-row--stacked">
          <div>
            <p className="eyebrow">Lead capture</p>
            <h2>Create enquiry</h2>
          </div>
          <p className="section-helper">Add the minimum details needed to track an early lead and prepare staff-controlled follow-up.</p>
        </div>
        <form action={runCreateEnquiryAction} className="staff-form-grid">
          <label className="field"><span>First name</span><input name="firstName" placeholder="First name" /></label>
          <label className="field"><span>Last name</span><input name="lastName" placeholder="Last name" /></label>
          <label className="field"><span>Email</span><input name="email" type="email" required placeholder="client@example.com" /></label>
          <label className="field"><span>Phone</span><input name="phone" placeholder="Phone" /></label>
          <label className="field"><span>Enquiry source</span><input name="enquirySource" placeholder="Website, referral, phone, event" /></label>
          <label className="field"><span>Intended pathway</span><input name="intendedPathway" placeholder="Skilled, student, partner/family…" /></label>
          <label className="field"><span>Country of residence</span><input name="countryOfResidence" placeholder="Country of residence" /></label>
          <div className="form-actions"><button type="submit" className="primary-btn">Create enquiry</button></div>
        </form>
      </section>

      <section className="section staff-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h2>Enquiry records</h2>
          </div>
          <p className="section-helper">{enquiries.length} record{enquiries.length === 1 ? '' : 's'} shown</p>
        </div>
        <div className="table-wrap staff-table-wrap">
          <table className="dashboard-table staff-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Enquiry source</th>
                <th>Intended pathway</th>
                <th>Country of residence</th>
                <th>Created</th>
                <th>Latest FAQ/pre-intake email status</th>
                <th>Intake link/status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.length === 0 ? (
                <tr><td colSpan={10} className="empty-table-cell">No enquiries yet. Create an enquiry above when an early lead needs staff follow-up.</td></tr>
              ) : enquiries.map((enq) => {
                const latest = enq.communications[0];
                const displayName = `${enq.firstName ?? ''} ${enq.lastName ?? ''}`.trim() || 'Not provided';
                return (
                  <tr key={enq.id}>
                    <td><strong>{displayName}</strong></td>
                    <td>{enq.email}</td>
                    <td>{enq.phone || 'Not provided'}</td>
                    <td>{enq.enquirySource || 'Not provided'}</td>
                    <td>{enq.intendedPathway || 'Not provided'}</td>
                    <td>{enq.countryOfResidence || 'Not provided'}</td>
                    <td>{formatStaffDate(enq.createdAt)}</td>
                    <td>
                      {latest ? (
                        <span className={statusPillClass(latest.status)}>{latest.status} ({latest.type})</span>
                      ) : <span className="pill pill--placeholder">No FAQ/pre-intake email yet</span>}
                    </td>
                    <td>
                      {enq.intakeSubmission ? (
                        <Link href={`/dashboard/intakes/${enq.intakeSubmission.id}`} className="secondary-btn">Linked intake: {enq.intakeSubmission.status}</Link>
                      ) : <span className="pill pill--placeholder">Not linked</span>}
                    </td>
                    <td>
                      <div className="table-actions">
                        <form action={runDraftFaqAction} className="inline-staff-form">
                          <input type="hidden" name="enquiryId" value={enq.id} />
                          <label className="field"><span>Email template</span><select name="template">{TEMPLATE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
                          <button type="submit" className="secondary-btn">Draft FAQ/pre-intake email</button>
                        </form>
                        {latest ? (
                          <form action={runSendFaqAction} className="inline-staff-form">
                            <input type="hidden" name="communicationId" value={latest.id} />
                            <label className="field"><span>Internal reason</span><input name="internalReason" required placeholder="Internal reason/note required" /></label>
                            <button type="submit" className="primary-btn">Send FAQ/pre-intake email</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
