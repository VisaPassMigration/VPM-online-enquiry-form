import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';
import { AuditEventType, Prisma } from '@prisma/client';
import Link from 'next/link';

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

type SearchParams = Record<string, string | string[] | undefined>;

const getParam = (searchParams: SearchParams, key: string): string => {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return value?.trim() ?? '';
};

const eventTypes = Object.values(AuditEventType);

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const filters = {
    actorId: getParam(resolvedSearchParams, 'actorId'),
    actorRole: getParam(resolvedSearchParams, 'actorRole'),
    eventType: getParam(resolvedSearchParams, 'eventType'),
    submissionId: getParam(resolvedSearchParams, 'submissionId'),
    relatedEntityType: getParam(resolvedSearchParams, 'relatedEntityType'),
    relatedEntityId: getParam(resolvedSearchParams, 'relatedEntityId'),
    dateFrom: getParam(resolvedSearchParams, 'dateFrom'),
    dateTo: getParam(resolvedSearchParams, 'dateTo'),
    q: getParam(resolvedSearchParams, 'q'),
  };

  const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : null;
  const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`) : null;

  const where: Prisma.AuditEventWhereInput = {
    ...(filters.actorId ? { actorId: { equals: filters.actorId, mode: 'insensitive' } } : {}),
    ...(filters.actorRole ? { actorRole: { equals: filters.actorRole, mode: 'insensitive' } } : {}),
    ...(filters.eventType && eventTypes.includes(filters.eventType as AuditEventType)
      ? { eventType: filters.eventType as AuditEventType }
      : {}),
    ...(filters.submissionId ? { submissionId: { equals: filters.submissionId, mode: 'insensitive' } } : {}),
    ...(filters.relatedEntityType ? { relatedEntityType: { equals: filters.relatedEntityType, mode: 'insensitive' } } : {}),
    ...(filters.relatedEntityId ? { relatedEntityId: { equals: filters.relatedEntityId, mode: 'insensitive' } } : {}),
    ...((dateFrom || dateTo)
      ? {
          eventAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { reason: { contains: filters.q, mode: 'insensitive' } },
            { internalNote: { contains: filters.q, mode: 'insensitive' } },
            { metadata: { path: [], string_contains: filters.q } },
          ],
        }
      : {}),
  };

  const auditEvents = await db.auditEvent.findMany({ where, orderBy: { eventAt: 'desc' }, take: 200 });

  const activeFilters = [
    ['Actor ID', filters.actorId],
    ['Actor role', filters.actorRole],
    ['Event type', filters.eventType],
    ['Submission ID', filters.submissionId],
    ['Related entity type', filters.relatedEntityType],
    ['Related entity ID', filters.relatedEntityId],
    ['Date from', filters.dateFrom],
    ['Date to', filters.dateTo],
    ['Text search', filters.q],
  ].filter(([, value]) => Boolean(value));

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
          <h3>Filters</h3>
        </div>
        <form method="get" className="audit-filter-grid" aria-label="Audit log filters">
          <label className="card audit-filter-card">
            Actor ID
            <input name="actorId" defaultValue={filters.actorId} />
          </label>
          <label className="card audit-filter-card">
            Actor role
            <input name="actorRole" defaultValue={filters.actorRole} />
          </label>
          <label className="card audit-filter-card">
            Event type
            <select name="eventType" defaultValue={filters.eventType}>
              <option value="">All</option>
              {eventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>
          </label>
          <label className="card audit-filter-card">
            Submission ID
            <input name="submissionId" defaultValue={filters.submissionId} />
          </label>
          <label className="card audit-filter-card">
            Related entity type
            <input name="relatedEntityType" defaultValue={filters.relatedEntityType} />
          </label>
          <label className="card audit-filter-card">
            Related entity ID
            <input name="relatedEntityId" defaultValue={filters.relatedEntityId} />
          </label>
          <label className="card audit-filter-card">
            Date from
            <input name="dateFrom" type="date" defaultValue={filters.dateFrom} />
          </label>
          <label className="card audit-filter-card">
            Date to
            <input name="dateTo" type="date" defaultValue={filters.dateTo} />
          </label>
          <label className="card audit-filter-card">
            Text search
            <input name="q" defaultValue={filters.q} placeholder="reason / internal note / metadata" />
          </label>
          <div className="card audit-filter-card">
            <button type="submit">Apply filters</button>
            <Link href="/admin/audit-log">Clear filters</Link>
          </div>
        </form>
      </section>

      <section className="section">
        <p>
          <strong>Active filters:</strong>{' '}
          {activeFilters.length === 0
            ? 'None'
            : activeFilters.map(([label, value]) => `${label}: ${value}`).join(' • ')}
        </p>
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
                  <td colSpan={12}>No audit events match the selected filters.</td>
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
