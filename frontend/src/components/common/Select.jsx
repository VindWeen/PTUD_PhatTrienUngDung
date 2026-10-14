import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const optionText = children => React.Children.toArray(children).map(child => typeof child === 'object' ? optionText(child.props?.children) : String(child)).join('');
function collectOptions(children) {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement(child)) return [];
    if (child.type === 'option') return [{ value: String(child.props.value ?? optionText(child.props.children)), label: optionText(child.props.children), disabled: child.props.disabled }];
    return collectOptions(child.props.children);
  });
}

export default function Select({ children, value, onChange, className, disabled, required, name, id, ...props }) {
  const generatedId = useId();
  const listId = `${generatedId}-options`;
  const button = useRef(null);
  const native = useRef(null);
  const menu = useRef(null);
  const search = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const options = collectOptions(children);
  const selected = options.findIndex(option => option.value === String(value ?? ''));
  const label = options[selected]?.label || 'Chọn giá trị';

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = button.current.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const up = below < 180 && above > below;
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, ...(up ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }), maxHeight: Math.max(80, Math.min(288, up ? above : below)) });
    }
    const outside = e => { if (!button.current?.contains(e.target) && !menu.current?.contains(e.target)) setOpen(false); };
    place();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => { if (open) menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active, open]);

  function choose(index) {
    const option = options[index];
    if (!option || option.disabled) return;
    native.current.value = option.value;
    native.current.dispatchEvent(new Event('change', { bubbles: true }));
    setInvalid(false); setOpen(false); button.current.focus();
  }
  function move(direction) {
    let next = active;
    for (let i = 0; i < options.length; i++) {
      next = (next + direction + options.length) % options.length;
      if (!options[next].disabled) { setActive(next); break; }
    }
  }
  function keyDown(e) {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      if (!open) { setActive(Math.max(0, selected)); setOpen(true); return; }
      if (e.key === 'ArrowDown') move(1);
      else if (e.key === 'ArrowUp') move(-1);
      else if (e.key === 'Home') setActive(options.findIndex(option => !option.disabled));
      else if (e.key === 'End') setActive(options.findLastIndex(option => !option.disabled));
      else choose(active);
    } else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      search.current.text = (Date.now() - search.current.at < 700 ? search.current.text : '') + e.key.toLocaleLowerCase('vi');
      search.current.at = Date.now();
      const index = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase('vi').startsWith(search.current.text));
      if (index >= 0) { setActive(index); setOpen(true); }
    }
  }

  return <>
    <button {...props} ref={button} id={id} type="button" role="combobox" disabled={disabled} aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-required={required || undefined} aria-invalid={invalid || undefined} aria-activedescendant={open ? `${listId}-${active}` : undefined} onKeyDown={keyDown} onClick={() => { setActive(Math.max(0, selected)); setOpen(v => !v); }}
      className={twMerge('relative min-w-[140px] max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 shadow-sm transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200', className, 'flex items-center justify-between gap-3 pr-10 text-left outline-none hover:border-teal-400 focus-visible:border-teal-500 focus-visible:ring-4 focus-visible:ring-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50', open && 'border-teal-500 ring-4 ring-teal-500/10', invalid && 'border-rose-500')}>
      <span className="min-w-0 truncate">{label}</span><ChevronDown aria-hidden="true" className={`absolute right-3 h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180 text-teal-600' : ''}`} />
    </button>
    <select ref={native} value={value} onChange={onChange} name={name} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true" className="sr-only" onInvalid={e => { e.preventDefault(); setInvalid(true); button.current.focus(); }}>{children}</select>
    {open && position && createPortal(<div ref={menu} id={listId} role="listbox" aria-label={props['aria-label'] || 'Các lựa chọn'} style={position} className="fixed z-[100] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_14px_45px_-10px_rgba(15,23,42,0.25)] dark:border-slate-700 dark:bg-slate-800">
      {options.map((option, index) => <div key={`${option.value}-${index}`} id={`${listId}-${index}`} role="option" aria-selected={index === selected} aria-disabled={option.disabled || undefined} data-index={index} onPointerMove={() => !option.disabled && setActive(index)} onMouseDown={e => e.preventDefault()} onClick={() => choose(index)} className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-sm transition-colors ${option.disabled ? 'cursor-not-allowed opacity-40' : index === selected ? 'bg-teal-50 font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' : index === active ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-200'}`}><span>{option.label}</span>{index === selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />}</div>)}
      {!options.length && <p className="px-3 py-3 text-sm text-slate-400">Chưa có lựa chọn.</p>}
    </div>, document.body)}
  </>;
}
