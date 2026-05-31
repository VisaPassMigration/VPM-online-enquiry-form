import { redirect } from 'next/navigation';

import { auth } from '@/auth';

export async function requireStaffSession() {
  const session = await auth();
  if (!session?.user || !session.user.isActive || !session.user.staffUserId) {
    redirect('/api/auth/signin?callbackUrl=%2Fdashboard');
  }
  return session;
}
