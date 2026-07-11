import { useToastStore } from '../store/toastStore';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1000 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => dismissToast(toast.id)}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            background: toast.type === 'error' ? 'var(--bp-danger-bg)' : 'var(--bp-success-bg)',
            border: `1px solid ${toast.type === 'error' ? 'var(--bp-danger-border)' : 'var(--bp-success-border)'}`,
            color: toast.type === 'error' ? 'var(--bp-danger)' : 'var(--bp-success)',
            cursor: 'pointer',
            maxWidth: '320px',
            fontSize: '0.9rem',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)'
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
