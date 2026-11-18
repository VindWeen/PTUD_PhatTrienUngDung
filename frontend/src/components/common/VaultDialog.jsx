import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function VaultDialog({ open, onClose, title, subtitle, maxWidth, drawer, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={"vault-modal" + (drawer ? " achievement-drawer" : maxWidth ? " " + maxWidth : "")}
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(event); }}
      onClick={e => { if (e.target === e.currentTarget) onClose(e); }}
    >
      <div className="vault-modal-heading">
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p className="vault-meta">{subtitle}</p>}</div>
        <button type="button" className="soft-btn-secondary" aria-label="Đóng" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="vault-modal-body">{children}</div>
    </dialog>
  );
}
