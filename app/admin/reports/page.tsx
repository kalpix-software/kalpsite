'use client';

import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface UserReport {
  reportId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  description?: string;
  status: string;
  reporterUsername?: string;
  reporterDisplayName?: string;
  reportedUsername?: string;
  reportedDisplayName?: string;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  reviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  dismissed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  action_taken: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: AlertTriangle,
  reviewed: CheckCircle,
  dismissed: XCircle,
  action_taken: Shield,
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate Content',
  other: 'Other',
};

function formatDate(ts: number): string {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString();
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [filterUserId, setFilterUserId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Pagination
  const [cursor, setCursor] = useState('');
  const [nextCursor, setNextCursor] = useState('');
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState('');

  const fetchReports = async (newCursor = '') => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await callAdminRpc(
        'chat/admin_list_user_reports',
        JSON.stringify({
          reportedUserId: filterUserId.trim() || undefined,
          status: filterStatus || undefined,
          limit: 20,
          cursor: newCursor || undefined,
        })
      );
      const raw = (data?.data ?? data) as {
        reports?: UserReport[];
        nextCursor?: string;
        count?: number;
      };
      setReports(raw?.reports ?? []);
      setNextCursor(raw?.nextCursor ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCursor('');
    setCursorHistory([]);
    setPage(1);
    fetchReports('');
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor]);
    setCursor(nextCursor);
    setPage((p) => p + 1);
    fetchReports(nextCursor);
  };

  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return;
    const prev = [...cursorHistory];
    const prevCursor = prev.pop() ?? '';
    setCursorHistory(prev);
    setCursor(prevCursor);
    setPage((p) => Math.max(1, p - 1));
    fetchReports(prevCursor);
  };

  const updateStatus = async (report: UserReport, newStatus: string) => {
    setUpdatingId(report.reportId);
    setError('');
    setSuccess('');
    try {
      await callAdminRpc(
        'chat/admin_update_report_status',
        JSON.stringify({
          reportId: report.reportId,
          reporterId: report.reporterId,
          status: newStatus,
        })
      );
      setSuccess(`Report ${report.reportId.slice(0, 8)}... marked as ${newStatus}`);
      // Refresh the current page
      fetchReports(cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update report');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-1">User Reports</h1>
      <p className="text-sm text-slate-400 mb-6">
        Review and manage user reports. Filter by reported user or status.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Filter by reported User ID (optional)"
          className="flex-1 min-w-[240px] max-w-md px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm placeholder:text-slate-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="action_taken">Action Taken</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Reports Table */}
      {reports.length > 0 ? (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reported User</th>
                  <th className="px-4 py-3 font-medium">Reporter</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {reports.map((r) => {
                  const StatusIcon = STATUS_ICONS[r.status] ?? AlertTriangle;
                  return (
                    <tr key={r.reportId} className="hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[r.status] ?? STATUS_COLORS.pending}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-100 font-medium">
                          {r.reportedDisplayName || r.reportedUsername || '-'}
                        </div>
                        <div className="text-slate-500 text-xs font-mono truncate max-w-[160px]" title={r.reportedId}>
                          {r.reportedId.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-300">
                          {r.reporterDisplayName || r.reporterUsername || '-'}
                        </div>
                        <div className="text-slate-500 text-xs font-mono truncate max-w-[160px]" title={r.reporterId}>
                          {r.reporterId.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-200">{REASON_LABELS[r.reason] ?? r.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-400 text-xs max-w-[200px] block truncate" title={r.description}>
                          {r.description || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {formatDate(r.createdAt)}
                        {r.reviewedAt ? (
                          <div className="text-slate-500 mt-0.5">
                            Reviewed: {formatDate(r.reviewedAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'pending' ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => updateStatus(r, 'reviewed')}
                              disabled={updatingId === r.reportId}
                              className="px-2.5 py-1 rounded-md bg-blue-600/20 text-blue-400 text-xs font-medium hover:bg-blue-600/30 disabled:opacity-50 border border-blue-500/30"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => updateStatus(r, 'action_taken')}
                              disabled={updatingId === r.reportId}
                              className="px-2.5 py-1 rounded-md bg-red-600/20 text-red-400 text-xs font-medium hover:bg-red-600/30 disabled:opacity-50 border border-red-500/30"
                            >
                              Action
                            </button>
                            <button
                              onClick={() => updateStatus(r, 'dismissed')}
                              disabled={updatingId === r.reportId}
                              className="px-2.5 py-1 rounded-md bg-slate-600/20 text-slate-400 text-xs font-medium hover:bg-slate-600/30 disabled:opacity-50 border border-slate-500/30"
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic">
                            {r.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-t border-slate-700">
            <span className="text-sm text-slate-400">
              Page {page} &middot; {reports.length} result{reports.length !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <button
                onClick={handleNextPage}
                disabled={!nextCursor}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : !loading ? (
        <div className="text-center py-12 text-slate-500">
          {reports.length === 0 && page === 1
            ? 'Click Search to load reports, or filter by user ID / status.'
            : 'No reports found.'}
        </div>
      ) : null}
    </div>
  );
}
