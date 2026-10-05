import { useEffect } from 'react';
import { errorMessage } from '@durak/shared';
import { useHandStore } from '../../store/handStore';

const TOAST_MS = 2500;

/** A rejected move: the card has already snapped back, this says why. */
export function ErrorToast() {
  const toast = useHandStore((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => useHandStore.getState().clearToast(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="toast" role="alert" key={toast.id}>
      {errorMessage(toast.code)}
    </div>
  );
}
