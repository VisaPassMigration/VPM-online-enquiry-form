import React from 'react';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePermission(PERMISSIONS.VIEW_DASHBOARD);

  return (
    <section className="section staff-page">
      <h1>Reports</h1>
      <p>Reporting is not built yet. This page is a placeholder for consolidated activity and outcome reports.</p>
    </section>
  );
}
