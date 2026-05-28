import { EnquiryCommunicationType } from '@prisma/client';

import { auth } from '@/auth';
import { PERMISSIONS, resolveActorRole, type RoleKey } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
import { createEnquiry, draftEnquiryFaqEmail, sendEnquiryFaqEmail } from '@/server/enquiryCommunications';

const intakeFormUrl = process.env.NEXT_PUBLIC_INTAKE_FORM_URL?.trim() || '[INTAKE_FORM_LINK]';

const toActor = async () => {
  const session = await auth();
  if (!session?.user?.id || !session.user.staffUserId) throw new Error('Authenticated staff actor context is required.');
  const roles = (session.user.roles ?? []) as RoleKey[];
  return { actorId: session.user.id, actorRole: resolveActorRole(session.user.roles ?? []), actorStaffUserId: session.user.staffUserId, actorRoles: roles };
};

export async function runCreateEnquiryAction(formData: FormData) {
  'use server';
  await requirePermission(PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL);
  await createEnquiry({
    firstName: String(formData.get('firstName') || '').trim() || undefined,
    lastName: String(formData.get('lastName') || '').trim() || undefined,
    email: String(formData.get('email') || '').trim(),
    phone: String(formData.get('phone') || '').trim() || undefined,
    enquirySource: String(formData.get('enquirySource') || '').trim() || undefined,
    intendedPathway: String(formData.get('intendedPathway') || '').trim() || undefined,
    countryOfResidence: String(formData.get('countryOfResidence') || '').trim() || undefined,
  });
}

export async function runDraftFaqAction(formData: FormData) {
  'use server';
  await requirePermission(PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL);
  const actor = await toActor();
  await draftEnquiryFaqEmail({ enquiryId: String(formData.get('enquiryId')), type: String(formData.get('template')) as EnquiryCommunicationType, actor, intakeLinkUrl: intakeFormUrl });
}

export async function runSendFaqAction(formData: FormData) {
  'use server';
  await requirePermission(PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL);
  const actor = await toActor();
  await sendEnquiryFaqEmail({ communicationId: String(formData.get('communicationId')), internalReason: String(formData.get('internalReason') || '').trim(), actor });
}
