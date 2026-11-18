import React, { useId } from 'react';

export default function VaultTabs({ items, value, onChange, label, children }) {
  const id = useId();
  return <>
    <div className="vault-tabs" role="tablist" aria-label={label || 'Các mục'}>
      {items.map(([key, text], index) => (
        <button
          key={key}
          id={id + '-' + key}
          type="button"
          role="tab"
          aria-selected={value === key}
          aria-controls={children ? id + '-panel' : undefined}
          tabIndex={value === key ? 0 : -1}
          onClick={() => onChange(key)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
            onChange(items[next][0]);
            event.currentTarget.parentElement.children[next].focus();
          }}
        >
          {text}
        </button>
      ))}
    </div>
    {children && <div role="tabpanel" id={id + '-panel'} aria-labelledby={id + '-' + value}>{children}</div>}
  </>;
}
