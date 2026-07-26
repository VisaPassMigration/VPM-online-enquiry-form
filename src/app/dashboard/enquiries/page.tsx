import React from 'react';
import Link from 'next/link';
import { EnquiryCommunicationType } from '@prisma/client';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';
import { db } from '@/server/db';
import { runCreateEnquiryAction, runDraftFaqAction, runSendFaqAction } from './actions';
import { formatStaffDate, faqStatusLabel, statusPillClass } from './format';

export const dynamic = "force-dynamic";

const TEMPLATE_OPTIONS: Array<{ value: EnquiryCommunicationType; label: string }> = [
  { value: 'faq_general_migration', label: 'General migration enquiry' },
  { value: 'faq_skilled_migration', label: 'Skilled migration enquiry' },
  { value: 'faq_student_visa', label: 'Student visa enquiry' },
  { value: 'faq_partner_family', label: 'Partner/family enquiry' },
  { value: 'faq_employer_sponsored', label: 'Employer-sponsored enquiry' },
  { value: 'faq_insufficient_information', label: 'Not enough information / please complete questionnaire' },
];

const isIntakeUrlConfigured = Boolean(process.env.NEXT_PUBLIC_INTAKE_FORM_URL?.trim());

const intakeStatusFor = (hasIntakeSubmission: boolean, intakeStatus: string | undefined, latestStatus: string | undefined) => {
  if (hasIntakeSubmission) return { label: `Intake submitted: ${intakeStatus ?? 'status pending'}`, className: 'status-badge status-badge--success' };
  if (!isIntakeUrlConfigured) return { label: 'Intake URL not configured', className: 'status-badge status-badge--warning' };
  if (latestStatus === 'sent') return { label: 'Link sent', className: 'status-badge status-badge--success' };
  if (latestStatus === 'drafted_internal' || latestStatus === 'pending_staff_release') return { label: 'Link ready', className: 'status-badge status-badge--warning' };
  return { label: 'Not linked', className: 'status-badge status-badge--muted' };
};

const getParam = (params: Record<string, string | string[] | undefined>, key: string) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.VIEW_DASHBOARD);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const duplicateEnquiryId = getParam(resolvedSearchParams, 'duplicateEnquiryId');
  const [enquiries, duplicateEnquiry] = await Promise.all([
    db.enquiry.findMany({
      include: {
        intakeSubmission: { select: { id: true, status: true } },
        communications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    duplicateEnquiryId ? db.enquiry.findUnique({ where: { id: duplicateEnquiryId } }) : Promise.resolve(null),
  ]);

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
          <p>Drafting prepares an internal draft. Sending only happens when staff explicitly use the send action with an internal reason.</p>
        </article>
        {!isIntakeUrlConfigured ? (
          <article className="callout-card callout-card--warning">
            <strong>Configuration issue, not a client issue:</strong>
            <p>NEXT_PUBLIC_INTAKE_FORM_URL is not set. Drafts safely keep the placeholder [INTAKE_FORM_LINK] until the intake URL is configured.</p>
          </article>
        ) : null}
      </section>

      {duplicateEnquiry ? (
        <section className="callout-card callout-card--warning duplicate-warning" role="alert">
          <strong>Possible duplicate: this email or phone already exists in enquiry records.</strong>
          <p>
            Existing enquiry: {`${duplicateEnquiry.firstName ?? ''} ${duplicateEnquiry.lastName ?? ''}`.trim() || duplicateEnquiry.email} · {duplicateEnquiry.email}
            {duplicateEnquiry.phone ? ` · ${duplicateEnquiry.phone}` : ''} · created {formatStaffDate(duplicateEnquiry.createdAt)}.
          </p>
          <p className="section-helper">Review the existing record below. If this is a legitimate new enquiry, tick “Create anyway after duplicate review” before submitting again.</p>
        </section>
      ) : null}

      <section className="section staff-section">
        <div className="section-heading-row section-heading-row--stacked">
          <div>
            <p className="eyebrow">Lead capture</p>
            <h2>Create enquiry</h2>
          </div>
          <p className="section-helper">Add the minimum details needed to track an early lead and prepare staff-controlled follow-up. Email is normalised to lowercase before duplicate checks.</p>
        </div>
        <form action={runCreateEnquiryAction} className="staff-form-grid">
          <label className="field"><span>First name</span><input name="firstName" placeholder="First name" /></label>
          <label className="field"><span>Last name</span><input name="lastName" placeholder="Last name" /></label>
          <label className="field"><span>Email</span><input name="email" type="email" required placeholder="client@example.com" /></label>
          <label className="field"><span>Phone</span><input name="phone" placeholder="Phone" /></label>
          <label className="field"><span>Enquiry source</span><input name="enquirySource" placeholder="Website, referral, phone, event" /></label>
          <label className="field"><span>Intended pathway</span><input name="intendedPathway" placeholder="Skilled, student, partner/family…" /></label>
          <label className="field"><span>Country of residence</span><input name="countryOfResidence" placeholder="Country of residence" /></label>
          <label className="duplicate-confirm"><input type="checkbox" name="allowDuplicate" /> Create anyway after duplicate review</label>
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
        <div className="table-wrap staff-table-wrap enquiries-table-wrap">
          <table className="dashboard-table staff-table enquiries-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Intended pathway</th>
                <th>Created</th>
                <th>FAQ status</th>
                <th>Intake status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.length === 0 ? (
                <tr><td colSpan={8} className="empty-table-cell">No enquiries yet. Create an enquiry above when an early lead needs staff follow-up.</td></tr>
              ) : enquiries.map((enq) => {
                const latest = enq.communications[0];
                const displayName = `${enq.firstName ?? ''} ${enq.lastName ?? ''}`.trim() || 'Not provided';
                const intakeStatus = intakeStatusFor(Boolean(enq.intakeSubmission), enq.intakeSubmission?.status, latest?.status);
                const detailHref = enq.intakeSubmission ? `/dashboard/intakes/${enq.intakeSubmission.id}` : `/dashboard/enquiries/${enq.id}`;
                return (
                  <tr key={enq.id}>
                    <td>
                      <Link href={detailHref} className="review-queue-client-link">{displayName}</Link>
                      <span className="cell-secondary">Source: {enq.enquirySource || 'Not provided'} · Residence: {enq.countryOfResidence || 'Not provided'}</span>
                    </td>
                    <td>{enq.email}</td>
                    <td>{enq.phone || 'Not provided'}</td>
                    <td>{enq.intendedPathway || 'Not provided'}</td>
                    <td>{formatStaffDate(enq.createdAt)}</td>
                    <td>
                      <span className={statusPillClass(latest?.status)}>{faqStatusLabel(latest?.status)}</span>
                      <span className="cell-secondary">{latest ? latest.type.replaceAll('_', ' ') : 'Draft before sending.'}</span>
                    </td>
                    <td>
                      {enq.intakeSubmission ? (
                        <Link href={`/dashboard/intakes/${enq.intakeSubmission.id}`} className={intakeStatus.className}>{intakeStatus.label}</Link>
                      ) : <span className={intakeStatus.className}>{intakeStatus.label}</span>}
                      <span className="cell-secondary">Not linked means no completed intake submission is attached yet.</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link href={detailHref} className="secondary-btn review-queue-open-link">View enquiry</Link>
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
