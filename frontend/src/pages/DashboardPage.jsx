import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { usePermissionsStore } from '../store/permissionsStore';
import { useI18n } from '../i18n/useI18n';
import { industryOptions } from '../data/companyOptions';

const INDUSTRY_COLORS = {
  'Data analytics': 'var(--bp-navy)',
  Retail: 'var(--bp-success)',
  Engineering: 'var(--bp-warning)',
  Healthcare: 'var(--bp-danger)',
  Finance: 'var(--bp-gold)',
  Marketing: '#7c3aed',
  Operations: 'var(--bp-neutral)',
  Other: 'var(--bp-muted)'
};

const INDUSTRY_LABEL_KEYS = Object.fromEntries(industryOptions.map((opt) => [opt.value, opt.key]));
const FALLBACK_INDUSTRY_COLOR = '#94a3b8';

const COLUMN_ORDER = ['prospect', 'reschedule', 'sales', 'legalFinance', 'execution'];

const STATUS_META = {
  Prospect: { labelKey: 'dashboard.columnProspect', color: 'var(--bp-navy)' },
  Reschedule: { labelKey: 'dashboard.columnReschedule', color: 'var(--bp-warning)' },
  Active: { labelKey: 'dashboard.columnSales', color: 'var(--bp-success)' },
  Finalizing: { labelKey: 'dashboard.columnLegalFinance', color: 'var(--bp-neutral)' },
  Executing: { labelKey: 'nav.phase4', color: 'var(--bp-gold)' },
  Completed: { labelKey: 'tasks.completedLabel', color: 'var(--bp-success)' }
};

const STATUS_FILTER_OPTIONS = [
  { status: 'Prospect', labelKey: 'dashboard.columnProspect', color: 'var(--bp-navy)' },
  { status: 'Reschedule', labelKey: 'dashboard.columnReschedule', color: 'var(--bp-warning)' },
  { status: 'Active', labelKey: 'dashboard.columnSales', color: 'var(--bp-success)' },
  { status: 'Finalizing', labelKey: 'dashboard.columnLegalFinance', color: 'var(--bp-neutral)' },
  { status: 'Executing', labelKey: 'nav.phase4', color: 'var(--bp-gold)' },
  { status: 'Completed', labelKey: 'tasks.completedLabel', color: 'var(--bp-success)' }
];

const STATUS_BARS = [
  { status: 'Prospect', labelKey: 'dashboard.columnProspect', color: 'var(--bp-navy)' },
  { status: 'Reschedule', labelKey: 'dashboard.columnReschedule', color: 'var(--bp-warning)' },
  { status: 'Active', labelKey: 'dashboard.columnSales', color: 'var(--bp-success)' },
  { status: 'Finalizing', labelKey: 'dashboard.columnLegalFinance', color: 'var(--bp-neutral)' }
];

const SERVICE_BARS = [
  { key: 'consultation', labelKey: 'services.consultation', color: 'var(--bp-navy)' },
  { key: 'investment', labelKey: 'services.investment', color: 'var(--bp-gold)' },
  { key: 'businessSolutions', labelKey: 'services.businessSolutions', color: 'var(--bp-success)' }
];

const TABLE_PAGE_SIZE = 5;

export function DashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const pageKeys = usePermissionsStore((s) => s.pageKeys);
  const showToast = useToastStore((s) => s.showToast);
  const [columnsByKey, setColumnsByKey] = useState({});
  const [statusCounts, setStatusCounts] = useState({});
  const [industryCounts, setIndustryCounts] = useState([]);
  const [hoveredIndustry, setHoveredIndustry] = useState(null);
  const [hoveredTaskSegment, setHoveredTaskSegment] = useState(null);
  const [serviceCounts, setServiceCounts] = useState({});
  const [taskCounts, setTaskCounts] = useState({ open: 0, closed: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [tablePage, setTablePage] = useState(0);

  function matchesSearch(client) {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (client.contact_name || '').toLowerCase().includes(query) || (client.phone || '').toLowerCase().includes(query);
  }

  function handleSearchChange(value) {
    setSearchQuery(value);
    setTablePage(0);
  }

  function toggleStatusFilter(status) {
    setStatusFilter((prev) => (prev === status ? null : status));
    setTablePage(0);
  }

  function handleViewClient(client) {
    navigate(`/${client.stage}`, { state: { selectClientId: client.id } });
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/dashboard');
        if (!res.ok) throw new Error('Failed to load dashboard');
        const data = await res.json();
        const map = {};
        for (const col of data.columns || []) {
          map[col.key] = col.clients || [];
        }
        setColumnsByKey(map);
        setStatusCounts(data.statusCounts || {});
        setIndustryCounts(data.industryCounts || []);
        setServiceCounts(data.serviceCounts || {});
        setTaskCounts(data.taskCounts || { open: 0, closed: 0 });
      } catch (err) {
        console.error(err);
        showToast(t('dashboard.loadFailed'), 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combinedClients = COLUMN_ORDER.flatMap((key) => columnsByKey[key] || [])
    .filter((c) => !statusFilter || c.status === statusFilter)
    .filter(matchesSearch);
  const tablePageCount = Math.max(1, Math.ceil(combinedClients.length / TABLE_PAGE_SIZE));
  const currentTablePage = Math.min(tablePage, tablePageCount - 1);
  const pagedClients = combinedClients.slice(
    currentTablePage * TABLE_PAGE_SIZE,
    currentTablePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE
  );

  return (
    <div>
      <div className="dashboard-intro">
        <h2>{t('dashboard.title')}</h2>
        <p>{t('dashboard.subtitle')}</p>
      </div>

      <div className="dashboard-charts-row">
        <div className="dashboard-chart-card">
          <h3 className="section-title">{t('dashboard.chartTitle')}</h3>
          <div className="status-chart">
            {(() => {
              const maxCount = Math.max(1, ...STATUS_BARS.map(({ status }) => statusCounts[status] || 0));
              return STATUS_BARS.map(({ status, labelKey, color }) => {
                const count = statusCounts[status] || 0;
                const pct = (count / maxCount) * 100;
                return (
                  <div className="status-chart-row" key={status}>
                    <span className="status-chart-label">{t(labelKey)}</span>
                    <div className="status-chart-track">
                      <div className="status-chart-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <strong className="status-chart-count">{count}</strong>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="dashboard-chart-card">
          <h3 className="section-title">{t('dashboard.industryChartTitle')}</h3>
          {industryCounts.length === 0 ? (
            <p className="dashboard-empty">{t('dashboard.emptyColumn')}</p>
          ) : (
            <div className="donut-chart-wrapper">
              {(() => {
                const total = industryCounts.reduce((sum, row) => sum + row.count, 0);
                const radius = 40;
                const circumference = 2 * Math.PI * radius;
                let cumulative = 0;
                const segments = industryCounts.map((row) => {
                  const color = INDUSTRY_COLORS[row.industry] || FALLBACK_INDUSTRY_COLOR;
                  const fraction = row.count / total;
                  const dash = fraction * circumference;
                  const offset = -cumulative * circumference;
                  cumulative += fraction;
                  return { ...row, color, dash, offset };
                });
                const hovered = segments.find((s) => s.industry === hoveredIndustry);
                return (
                  <div className="donut-chart">
                    <svg viewBox="0 0 100 100" className="donut-svg">
                      {segments.map((seg) => (
                        <circle
                          key={seg.industry}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={hoveredIndustry === seg.industry ? 20 : 16}
                          strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                          strokeDashoffset={seg.offset}
                          onMouseEnter={() => setHoveredIndustry(seg.industry)}
                          onMouseLeave={() => setHoveredIndustry(null)}
                          style={{ cursor: 'pointer', transition: 'stroke-width 0.15s ease' }}
                        />
                      ))}
                    </svg>
                    <div className="donut-chart-hole">
                      {hovered ? (
                        <>
                          <strong>{hovered.count}</strong>
                          <span>{INDUSTRY_LABEL_KEYS[hovered.industry] ? t(INDUSTRY_LABEL_KEYS[hovered.industry]) : hovered.industry}</span>
                        </>
                      ) : (
                        <>
                          <strong>{total}</strong>
                          <span>{t('dashboard.donutTotalLabel')}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="dashboard-chart-card">
          <h3 className="section-title">{t('dashboard.serviceChartTitle')}</h3>
          <div className="status-chart">
            {(() => {
              const maxCount = Math.max(1, ...SERVICE_BARS.map(({ key }) => serviceCounts[key] || 0));
              return SERVICE_BARS.map(({ key, labelKey, color }) => {
                const count = serviceCounts[key] || 0;
                const pct = (count / maxCount) * 100;
                return (
                  <div className="status-chart-row" key={key}>
                    <span className="status-chart-label">{t(labelKey)}</span>
                    <div className="status-chart-track">
                      <div className="status-chart-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <strong className="status-chart-count">{count}</strong>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="dashboard-chart-card">
          <h3 className="section-title">{t('dashboard.taskChartTitle')}</h3>
          {taskCounts.open + taskCounts.closed === 0 ? (
            <p className="dashboard-empty">{t('dashboard.emptyColumn')}</p>
          ) : (
            <div className="donut-chart-wrapper">
              {(() => {
                const total = taskCounts.open + taskCounts.closed;
                const radius = 40;
                const circumference = 2 * Math.PI * radius;
                const segments = [
                  { key: 'open', count: taskCounts.open, color: 'var(--bp-navy)', labelKey: 'dashboard.taskOpen' },
                  { key: 'closed', count: taskCounts.closed, color: 'var(--bp-success)', labelKey: 'dashboard.taskClosed' }
                ].filter((seg) => seg.count > 0);
                let cumulative = 0;
                const drawn = segments.map((seg) => {
                  const fraction = seg.count / total;
                  const dash = fraction * circumference;
                  const offset = -cumulative * circumference;
                  cumulative += fraction;
                  return { ...seg, dash, offset };
                });
                const hovered = drawn.find((s) => s.key === hoveredTaskSegment);
                return (
                  <div className="donut-chart">
                    <svg viewBox="0 0 100 100" className="donut-svg">
                      {drawn.map((seg) => (
                        <circle
                          key={seg.key}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={hoveredTaskSegment === seg.key ? 20 : 16}
                          strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                          strokeDashoffset={seg.offset}
                          onMouseEnter={() => setHoveredTaskSegment(seg.key)}
                          onMouseLeave={() => setHoveredTaskSegment(null)}
                          style={{ cursor: 'pointer', transition: 'stroke-width 0.15s ease' }}
                        />
                      ))}
                    </svg>
                    <div className="donut-chart-hole">
                      {hovered ? (
                        <>
                          <strong>{hovered.count}</strong>
                          <span>{t(hovered.labelKey)}</span>
                        </>
                      ) : (
                        <>
                          <strong>{total}</strong>
                          <span>{t('dashboard.donutTotalLabel')}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

      </div>

      <div className="dashboard-search">
        <div className="dashboard-search-input">
          <input
            type="text"
            className="search-input"
            placeholder={t('dashboard.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {STATUS_FILTER_OPTIONS.map(({ status, labelKey, color }) => {
            const active = statusFilter === status;
            return (
              <button
                key={status}
                className="button"
                type="button"
                onClick={() => toggleStatusFilter(status)}
                style={{
                  background: active ? color : 'transparent',
                  color: active ? '#ffffff' : color,
                  borderColor: color
                }}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('dashboard.tableClientName')}</th>
              <th>{t('dashboard.tableStatus')}</th>
              <th>{t('dashboard.tableCompanyName')}</th>
              <th>{t('dashboard.tableLastUpdated')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedClients.length === 0 ? (
              <tr>
                <td colSpan={5} className="dashboard-empty">
                  {searchQuery.trim() || statusFilter ? t('dashboard.noSearchMatches') : t('dashboard.emptyColumn')}
                </td>
              </tr>
            ) : (
              pagedClients.map((c) => {
                const meta = STATUS_META[c.status] || {};
                return (
                  <tr key={c.id}>
                    <td>{c.contact_name}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: meta.color || 'var(--bp-muted)',
                            flexShrink: 0
                          }}
                        />
                        {meta.labelKey ? t(meta.labelKey) : c.status}
                      </span>
                    </td>
                    <td>{c.company_name || '–'}</td>
                    <td>{c.updated_at ? new Date(c.updated_at).toLocaleString('en-US') : '–'}</td>
                    <td>
                      {pageKeys.includes(c.stage) && (
                        <button className="button neutral" type="button" onClick={() => handleViewClient(c)}>
                          {t('dashboard.viewClient')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {tablePageCount > 1 && (
        <div className="pagination-row" style={{ marginTop: '10px', borderTop: 'none' }}>
          <button
            className="button neutral"
            type="button"
            onClick={() => setTablePage((p) => Math.max(0, p - 1))}
            disabled={currentTablePage === 0}
            title={t('directory.prevPage')}
            aria-label={t('directory.prevPage')}
            style={{ padding: '4px 10px' }}
          >
            ‹
          </button>
          <span>
            {t('directory.pageIndicator').replace('{current}', String(currentTablePage + 1)).replace('{total}', String(tablePageCount))}
          </span>
          <button
            className="button neutral"
            type="button"
            onClick={() => setTablePage((p) => Math.min(tablePageCount - 1, p + 1))}
            disabled={currentTablePage >= tablePageCount - 1}
            title={t('directory.nextPage')}
            aria-label={t('directory.nextPage')}
            style={{ padding: '4px 10px' }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
