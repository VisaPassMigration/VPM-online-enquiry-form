export const formatStaffDate = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Perth',
  }).format(dateTime).replace(/\s(am|pm)$/i, (match) => match.toUpperCase());

export const faqStatusLabel = (status: string | undefined) => {
  if (!status) return 'Not prepared';
  if (status === 'drafted_internal' || status === 'pending_staff_release') return 'Draft prepared';
  if (status === 'sent') return 'Sent';
  if (status === 'failed') return 'Failed';
  if (status === 'cancelled') return 'Cancelled';
  return status.replaceAll('_', ' ');
};

export const statusPillClass = (status: string | undefined) => {
  if (!status) return 'status-badge status-badge--muted';
  if (status === 'sent') return 'status-badge status-badge--success';
  if (status === 'failed') return 'status-badge status-badge--danger';
  return 'status-badge status-badge--warning';
};
