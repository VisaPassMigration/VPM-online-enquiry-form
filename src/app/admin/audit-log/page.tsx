import { Prisma } from '@prisma/client';

import { db } from '@/server/db';

const displayDateTime = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(dateTime);

const stringifyJson = (value: Prisma.JsonValue | null): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const metadataSummary = (metadata: Prisma.JsonValue | null): string => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 'No structured metadata';
  }

  const keys = Object.keys(metadata as Prisma.JsonObject);
  return keys.length === 0 ? 'No structured metadata' : `${keys.length} metadata field${keys.length === 1 ? '' : 's'}`;
};

export default async function AdminAuditLogPage() {
  const auditEvents = await db.auditEvent.findMany({
    orderBy: { eventAt: 'desc' },
    take: 200,
  });

  const placeholderFilters = ['Staff member / actor', 'Event type', 'Submission ID', 'Date range', 'Related entity type', 'Text search'];

  return (
    <>
      <section className="hero">
        <h1>Boss/Admin Audit Log</h1>
        <p>Read-only internal audit history across submissions and related workflow entities.</p>
      </section>

      <section className="section dashboard-note" role="note" aria-label="Boss or admin audit log read-only note">
        <strong>Boss/Admin audit log is read-only.</strong> Audit events should not be edited or deleted through the application.
      </section>

      <section className="section">
        <div className="section-heading-row">
          <h3>Filters (placeholders)</h3>
        </div>
        <div className="audit-filter-grid" aria-label="Audit log filter placeholders">
          {placeholderFilters.map((filterLabel) => (
            <article className="card audit-filter-card" key={filterLabel}>
              <p>{filterLabel}</p>
              <span className="pill pill--placeholder">Placeholder</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading-row">
          <h3>Audit events</h3>
        </div>
        <div className="table-wrap">
          <table className="dashboard-table" aria-label="Boss or admin audit event log table">
            <thead>
              <tr>
                <th>Event date/time (UTC)</th>
                <th>Event type</th>
                <th>Actor ID</th>
                <th>Actor name</th>
                <th>Actor role</th>
                <th>Submission ID</th>
                <th>Related entity type</th>
                <th>Related entity ID</th>
                <th>Reason / internal note</th>
                <th>From value</th>
                <th>To value</th>
                <th>Metadata details</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.length === 0 ? (
                <tr>
                  <td colSpan={12}>No audit events available.</td>
                </tr>
              ) : (
                auditEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{displayDateTime(event.eventAt)}</td>
                    <td>{event.eventType}</td>
                    <td>{event.actorId ?? '—'}</td>
                    <td>{event.actorName ?? '—'}</td>
                    <td>{event.actorRole ?? '—'}</td>
                    <td>{event.submissionId}</td>
                    <td>{event.relatedEntityType ?? '—'}</td>
                    <td>{event.relatedEntityId ?? '—'}</td>
                    <td>{[event.reason, event.internalNote].filter(Boolean).join(' | ') || '—'}</td>
                    <td>
                      <pre className="audit-json">{stringifyJson(event.fromValue)}</pre>
                    </td>
                    <td>
                      <pre className="audit-json">{stringifyJson(event.toValue)}</pre>
                    </td>
                    <td>
                      <details>
                        <summary>{metadataSummary(event.metadata)}</summary>
                        <pre className="audit-json">{stringifyJson(event.metadata)}</pre>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
