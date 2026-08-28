import React from 'react';
import { StaffSidebar } from '@/components/StaffSidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebar = await StaffSidebar();

  return (
    <div className="staff-shell">
      {sidebar}
      <main className="staff-shell__content">{children}</main>
    </div>
  );
}
