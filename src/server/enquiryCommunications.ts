import { EnquiryCommunicationType, Prisma } from '@prisma/client';
import { db } from './db';
import { recordAuditEvent } from './audit';
import { hasPermission, PERMISSIONS, type RoleKey } from './auth/permissions';
import { sendEnquiryFaqEmail as dispatchEnquiryFaqEmail, type EmailSendResult, buildEnquiryFaqEmailTemplate } from './email';

type StaffActor = { actorId: string; actorRole: string; actorStaffUserId: string; actorRoles: RoleKey[] };
function assertStaffActor(actor: StaffActor) { if (!actor.actorId || !actor.actorStaffUserId) throw new Error('Authenticated staff actor context is required.'); }
function assertSendPermission(actor: StaffActor) { if (!hasPermission(actor.actorRoles, PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL)) throw new Error('Missing permission: send_enquiry_faq_email.'); }

export async function createEnquiry(input: { email: string; firstName?: string; lastName?: string; phone?: string; enquirySource?: string; enquiryMessage?: string; countryOfResidence?: string; nationality?: string; intendedPathway?: string; intakeSubmissionId?: string; }) {
  return db.enquiry.create({ data: input });
}

export async function draftEnquiryFaqEmail(input: { enquiryId: string; intakeSubmissionId?: string; type: EnquiryCommunicationType; templateVersion?: string; intakeLinkUrl?: string; actor: StaffActor; }) {
  assertStaffActor(input.actor); assertSendPermission(input.actor);
  const enquiry = await db.enquiry.findUnique({ where: { id: input.enquiryId } }); if (!enquiry) throw new Error('Enquiry not found.');
  const template = buildEnquiryFaqEmailTemplate({ type: input.type, intakeLinkUrl: input.intakeLinkUrl });
  const created = await db.enquiryCommunication.create({ data: { enquiryId: input.enquiryId, intakeSubmissionId: input.intakeSubmissionId ?? enquiry.intakeSubmissionId, type: input.type, status: 'drafted_internal', subject: template.subject, bodyText: template.bodyText, templateVersion: input.templateVersion ?? 'v1', intakeLinkUrlSnapshot: input.intakeLinkUrl ?? '[INTAKE_FORM_LINK]' } });
  if (created.intakeSubmissionId) await recordAuditEvent({ submissionId: created.intakeSubmissionId, eventType: "enquiry_faq_email_drafted" as never, actorId: input.actor.actorId, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'enquiry_communication', relatedEntityId: created.id, metadata: { enquiryId: input.enquiryId, communicationType: input.type } as Prisma.InputJsonObject, eventSource: 'enquiry_communications_service' });
  return created;
}

export async function sendEnquiryFaqEmail(input: { communicationId: string; internalReason: string; actor: StaffActor }): Promise<{ communicationId: string; sendResult: EmailSendResult; followUpTaskCreated: boolean; }> {
  assertStaffActor(input.actor); assertSendPermission(input.actor);
  if (!input.internalReason?.trim()) throw new Error('Internal reason/note is required to send FAQ/pre-intake email.');
  const comm = await db.enquiryCommunication.findUnique({ where: { id: input.communicationId }, include: { enquiry: true } }); if (!comm) throw new Error('Enquiry communication not found.');
  if (/consultation|book|calendly/i.test(comm.bodyText) || /eligible|approved|guaranteed|qualified|suitable|strong candidate/i.test(comm.bodyText)) throw new Error('Unsafe content detected.');
  const sendResult = await dispatchEnquiryFaqEmail({ to: comm.enquiry.email, subject: comm.subject, bodyText: comm.bodyText });
  const updated = await db.enquiryCommunication.update({ where: { id: comm.id }, data: { status: 'sent', provider: sendResult.provider, providerMessageId: sendResult.messageId, sentByStaffUserId: input.actor.actorStaffUserId, sentAt: new Date() } });
  if (updated.intakeSubmissionId) await recordAuditEvent({ submissionId: updated.intakeSubmissionId, eventType: "enquiry_faq_email_sent" as never, actorId: input.actor.actorId, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'enquiry_communication', relatedEntityId: updated.id, reason: input.internalReason, metadata: { enquiryId: updated.enquiryId, communicationType: updated.type, internalReason: input.internalReason } as Prisma.InputJsonObject, eventSource: 'enquiry_communications_service' });
  let followUpTaskCreated=false;
  if (updated.intakeSubmissionId && (db as any).staffTask?.create) { await (db as any).staffTask.create({ data: { submissionId: updated.intakeSubmissionId, taskType: 'follow_up_client', title: 'Follow up pre-intake questionnaire completion', status: 'open', priority: 'normal', dueDate: new Date(Date.now()+3*24*60*60*1000), internalOnly: true } }); followUpTaskCreated=true; }
  return { communicationId: updated.id, sendResult, followUpTaskCreated };
}

export async function markEnquiryFaqEmailFailed(input: { communicationId: string; failureReason: string; actor: StaffActor; }) {
  assertStaffActor(input.actor); assertSendPermission(input.actor);
  const updated = await db.enquiryCommunication.update({ where: { id: input.communicationId }, data: { status: 'failed', failureReason: input.failureReason } });
  if (updated.intakeSubmissionId) await recordAuditEvent({ submissionId: updated.intakeSubmissionId, eventType: "enquiry_faq_email_failed" as never, actorId: input.actor.actorId, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'enquiry_communication', relatedEntityId: updated.id, reason: input.failureReason, eventSource: 'enquiry_communications_service' });
  return updated;
}
