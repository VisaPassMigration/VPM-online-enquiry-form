import Link from 'next/link';
import { EnquiryCommunicationType } from '@prisma/client';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';
import { db } from '@/server/db';
import { runCreateEnquiryAction, runDraftFaqAction, runSendFaqAction } from './actions';

const TEMPLATE_OPTIONS: Array<{ value: EnquiryCommunicationType; label: string }> = [
  { value: 'faq_general_migration', label: 'General migration enquiry' },
  { value: 'faq_skilled_migration', label: 'Skilled migration enquiry' },
  { value: 'faq_student_visa', label: 'Student visa enquiry' },
  { value: 'faq_partner_family', label: 'Partner/family enquiry' },
  { value: 'faq_employer_sponsored', label: 'Employer-sponsored enquiry' },
  { value: 'faq_insufficient_information', label: 'Not enough information / please complete questionnaire' },
];

export default async function EnquiriesPage() {
  await requirePermission(PERMISSIONS.VIEW_DASHBOARD);
  const enquiries = await db.enquiry.findMany({ include: { intakeSubmission: { select: { id: true, status: true } }, communications: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' } });

  return <main className="dashboard"><h1>Enquiries</h1>
    <p>FAQ / Pre-Intake emails are staff-controlled information emails only. They do not confirm any migration outcome or send consultation links.</p>
    {!process.env.NEXT_PUBLIC_INTAKE_FORM_URL ? <p><strong>Intake link configuration:</strong> NEXT_PUBLIC_INTAKE_FORM_URL not set. Placeholder [INTAKE_FORM_LINK] is used in drafts until configured.</p> : null}
    <h2>Create enquiry</h2>
    <form action={runCreateEnquiryAction} className="intake-form"><input name="firstName" placeholder="First name" /><input name="lastName" placeholder="Last name" /><input name="email" type="email" required placeholder="Email" /><input name="phone" placeholder="Phone" /><input name="enquirySource" placeholder="Enquiry source" /><input name="intendedPathway" placeholder="Intended pathway" /><input name="countryOfResidence" placeholder="Country of residence" /><button type="submit">Create enquiry</button></form>
    <h2>Enquiry records</h2>
    <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Enquiry source</th><th>Intended pathway</th><th>Country of residence</th><th>Created</th><th>Latest FAQ/pre-intake email status</th><th>Intake link/status</th><th>Actions</th></tr></thead>
    <tbody>{enquiries.map((enq)=>{ const latest=enq.communications[0]; return <tr key={enq.id}><td>{`${enq.firstName ?? ''} ${enq.lastName ?? ''}`.trim() || 'Not provided'}</td><td>{enq.email}</td><td>{enq.phone || 'Not provided'}</td><td>{enq.enquirySource || 'Not provided'}</td><td>{enq.intendedPathway || 'Not provided'}</td><td>{enq.countryOfResidence || 'Not provided'}</td><td>{new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(enq.createdAt)}</td><td>{latest ? `${latest.status} (${latest.type})` : 'No FAQ/pre-intake email yet'}</td><td>{enq.intakeSubmission ? <Link href={`/dashboard/intakes/${enq.intakeSubmission.id}`}>Linked intake: {enq.intakeSubmission.status}</Link> : 'Not linked'}</td><td><form action={runDraftFaqAction} className="intake-form"><input type="hidden" name="enquiryId" value={enq.id} /><select name="template">{TEMPLATE_OPTIONS.map((opt)=><option key={opt.value} value={opt.value}>{opt.label}</option>)}</select><button type="submit">Draft FAQ/pre-intake email</button></form>{latest ? <form action={runSendFaqAction} className="intake-form"><input type="hidden" name="communicationId" value={latest.id} /><input name="internalReason" required placeholder="Internal reason/note required" /><button type="submit">Send FAQ/pre-intake email</button></form> : null}</td></tr>; })}</tbody></table>
  </main>;
}
