import { useState } from 'react';

export function CollapsibleSection({ title, headerExtra, defaultCollapsed = false, children }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div style={{ marginTop: '26px' }}>
      <div className="section-title-row">
        <h3 className="section-title">{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {headerExtra}
          <button
            className="button neutral"
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Maximize' : 'Minimize'}
            title={collapsed ? 'Maximize' : 'Minimize'}
          >
            {collapsed ? '+' : '−'}
          </button>
        </div>
      </div>
      {!collapsed && children}
    </div>
  );
}
