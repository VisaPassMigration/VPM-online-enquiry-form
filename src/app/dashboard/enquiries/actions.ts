import { EnquiryCommunicationType } from '@prisma/client';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PERMISSIONS, resolveActorRole, type RoleKey } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
import { db } from '@/server/db';
import { createEnquiry, draftEnquiryFaqEmail, sendEnquiryFaqEmail } from '@/server/enquiryCommunications';

const intakeFormUrl = process.env.NEXT_PUBLIC_INTAKE_FORM_URL?.trim() || '[INTAKE_FORM_LINK]';

const normalizeEmail = (value: FormDataEntryValue | null) => String(value || '').trim().toLowerCase();
const normalizePhone = (value: FormDataEntryValue | null) => String(value || '').trim();
const phoneDigits = (value: string | null | undefined) => String(value || '').replace(/\D/g, '');

const toActor = async () => {
  const session = await auth();
  if (!session?.user?.id || !session.user.staffUserId) throw new Error('Authenticated staff actor context is required.');
  const roles = (session.user.roles ?? []) as RoleKey[];
  return { actorId: session.user.id, actorRole: resolveActorRole(session.user.roles ?? []), actorStaffUserId: session.user.staffUserId, actorRoles: roles };
};

async function findPossibleDuplicateEnquiry(email: string, phone: string) {
  const digits = phoneDigits(phone);
  const candidates = await db.enquiry.findMany({
    where: {
      OR: [
        { email: { equals: email, mode: 'insensitive' } },
        ...(digits ? [{ phone: { not: null } }] : []),
      ],
    },
    select: { id: true, email: true, phone: true },
    orderBy: { createdAt: 'desc' },
  });

  return candidates.find((candidate) => {
    if (candidate.email.trim().toLowerCase() === email) return true;
    return Boolean(digits && phoneDigits(candidate.phone) === digits);
  });
}

export async function runCreateEnquiryAction(formData: FormData) {
  'use server';
  await requirePermission(PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL);
  const email = normalizeEmail(formData.get('email'));
  const phone = normalizePhone(formData.get('phone'));
  const allowDuplicate = formData.get('allowDuplicate') === 'on';

  if (!allowDuplicate) {
    const duplicate = await findPossibleDuplicateEnquiry(email, phone);
    if (duplicate) {
      redirect(`/dashboard/enquiries?duplicateEnquiryId=${encodeURIComponent(duplicate.id)}`);
    }
  }

  await createEnquiry({
    firstName: String(formData.get('firstName') || '').trim() || undefined,
    lastName: String(formData.get('lastName') || '').trim() || undefined,
    email,
    phone: phone || undefined,
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
