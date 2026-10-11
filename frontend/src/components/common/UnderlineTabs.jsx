import React, { useLayoutEffect, useRef, useState } from 'react';

export default function UnderlineTabs({ items, value, onChange, label = 'Chọn nội dung', disabled = false }) {
  const containerRef = useRef(null);
  const [indicator, setIndicator] = useState(null);
  const itemSignature = items.map(item => `${item.id}:${item.label}`).join('|');

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = () => {
      const selected = Array.from(container.querySelectorAll('button')).find(button => button.dataset.tabId === String(value));
      const next = selected ? { x: selected.offsetLeft, y: selected.offsetTop + selected.offsetHeight - 2, width: selected.offsetWidth } : null;
      setIndicator(previous => previous?.x === next?.x && previous?.y === next?.y && previous?.width === next?.width ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    container.querySelectorAll('button').forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [value, itemSignature]);

  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(containerRef.current.querySelectorAll('button:not(:disabled)'));
    const index = buttons.indexOf(event.target);
    if (index < 0 || !buttons.length) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
    buttons[nextIndex].click();
  };

  return <nav ref={containerRef} aria-label={label} data-underline-tabs onKeyDown={handleKeyDown} className="relative flex min-w-0 flex-wrap items-start gap-x-4 gap-y-1 sm:gap-x-6">
    {items.map(({ id, label: text, icon: Icon, disabled: itemDisabled }) => <button
      key={id} type="button" data-tab-id={id} aria-pressed={value === id} disabled={disabled || itemDisabled}
      onClick={() => onChange(id)}
      className={`relative inline-flex max-w-full items-center gap-2 px-0 py-3 text-left text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-50 ${value === id ? 'font-semibold text-teal-600 dark:text-teal-400' : 'font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}<span>{text}</span>
    </button>)}
    <span aria-hidden="true" data-tab-indicator className="pointer-events-none absolute left-0 top-0 h-0.5 bg-teal-600 transition-[transform,width] duration-300 ease-out motion-reduce:transition-none dark:bg-teal-400"
      style={{ width: indicator?.width || 0, transform: `translate3d(${indicator?.x || 0}px, ${indicator?.y || 0}px, 0)`, visibility: indicator ? 'visible' : 'hidden' }} />
  </nav>;
}
