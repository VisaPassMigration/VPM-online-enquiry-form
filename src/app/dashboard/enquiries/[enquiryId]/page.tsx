import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';
import { db } from '@/server/db';
import { formatStaffDate, faqStatusLabel, statusPillClass } from '../format';

export const dynamic = "force-dynamic";

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ enquiryId: string }>;
}) {
  await requirePermission(PERMISSIONS.VIEW_DASHBOARD);
  const { enquiryId } = await params;
  const enquiry = await db.enquiry.findUnique({
    where: { id: enquiryId },
    include: {
      communications: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!enquiry) notFound();
  if (enquiry.intakeSubmissionId) redirect(`/dashboard/intakes/${enquiry.intakeSubmissionId}`);

  const displayName = `${enquiry.firstName ?? ''} ${enquiry.lastName ?? ''}`.trim() || 'Not provided';

  return (
    <main className="staff-page">
      <section className="staff-hero">
        <div>
          <p className="eyebrow">Staff workspace</p>
          <h1>{displayName}</h1>
          <p>Enquiry record — captured {formatStaffDate(enquiry.createdAt)}.</p>
        </div>
        <Link href="/dashboard/enquiries" className="secondary-btn">Back to enquiries</Link>
      </section>

      <section className="callout-grid" aria-label="Enquiry record status">
        <article className="callout-card callout-card--info">
          <strong>This is an enquiry record only.</strong>
          <p>{displayName} has not yet submitted the Registration Form. There is no case file, lead rating, or C.L.E.A.R. preparation for this contact yet.</p>
        </article>
      </section>

      <section className="section staff-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Enquiry details</p>
            <h2>Contact and enquiry information</h2>
          </div>
        </div>
        <div className="staff-form-grid">
          <div className="field"><span>Name</span><strong>{displayName}</strong></div>
          <div className="field"><span>Email</span><strong>{enquiry.email}</strong></div>
          <div className="field"><span>Phone</span><strong>{enquiry.phone || 'Not provided'}</strong></div>
          <div className="field"><span>Enquiry source</span><strong>{enquiry.enquirySource || 'Not provided'}</strong></div>
          <div className="field"><span>Intended pathway</span><strong>{enquiry.intendedPathway || 'Not provided'}</strong></div>
          <div className="field"><span>Country of residence</span><strong>{enquiry.countryOfResidence || 'Not provided'}</strong></div>
          <div className="field"><span>Nationality</span><strong>{enquiry.nationality || 'Not provided'}</strong></div>
          <div className="field"><span>Created</span><strong>{formatStaffDate(enquiry.createdAt)}</strong></div>
          <div className="field"><span>Last updated</span><strong>{formatStaffDate(enquiry.updatedAt)}</strong></div>
        </div>
        <div className="field">
          <span>Enquiry message</span>
          <strong>{enquiry.enquiryMessage || 'Not provided'}</strong>
        </div>
      </section>

      <section className="section staff-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">History</p>
            <h2>Communications sent for this enquiry</h2>
          </div>
          <p className="section-helper">{enquiry.communications.length} communication{enquiry.communications.length === 1 ? '' : 's'} recorded</p>
        </div>
        <div className="table-wrap staff-table-wrap">
          <table className="dashboard-table staff-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Subject</th>
                <th>Prepared</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {enquiry.communications.length === 0 ? (
                <tr><td colSpan={5} className="empty-table-cell">No communications have been drafted or sent for this enquiry yet.</td></tr>
              ) : enquiry.communications.map((comm) => (
                <tr key={comm.id}>
                  <td>{comm.type.replaceAll('_', ' ')}</td>
                  <td><span className={statusPillClass(comm.status)}>{faqStatusLabel(comm.status)}</span></td>
                  <td>{comm.subject}</td>
                  <td>{formatStaffDate(comm.createdAt)}</td>
                  <td>{comm.sentAt ? formatStaffDate(comm.sentAt) : 'Not sent'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
