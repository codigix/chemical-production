import { Eye, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Modal, Button, cx } from './ui';

/*
  View / Edit / Delete icon buttons for a table row or card.
  Pass a string to editBlock / deleteBlock to disable that button; the string is shown as the tooltip.
  Omit a handler to hide that button.
*/
export function RowActions({ onView, onEdit, onDelete, editBlock, deleteBlock, deleteLabel = 'Delete' }) {
  const base = 'grid h-8 w-8 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35';
  return (
    <div className="inline-flex items-center gap-1.5">
      {onView && (
        <button type="button" title="View" aria-label="View" onClick={onView}
          className={cx(base, 'border-prod-100 bg-prod-50 text-prod-500 hover:bg-prod-500 hover:text-white dark:border-white/10 dark:bg-prod-500/15')}>
          <Eye size={15} />
        </button>
      )}
      {onEdit && (
        <button type="button" title={editBlock || 'Edit'} aria-label="Edit" onClick={onEdit} disabled={!!editBlock}
          className={cx(base, 'border-amber-100 bg-amber-50 text-amber-600 enabled:hover:bg-amber-500 enabled:hover:text-white dark:border-white/10 dark:bg-amber-500/15')}>
          <Pencil size={14} />
        </button>
      )}
      {onDelete && (
        <button type="button" title={deleteBlock || deleteLabel} aria-label={deleteLabel} onClick={onDelete} disabled={!!deleteBlock}
          className={cx(base, 'border-rose-100 bg-rose-50 text-rose-600 enabled:hover:bg-rose-500 enabled:hover:text-white dark:border-white/10 dark:bg-rose-500/15')}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/* "Are you sure?" dialog used before every delete / cancel / reverse */
export function ConfirmDialog({ open, title = 'Delete record?', message, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button className="bg-rose-600 hover:bg-rose-700" icon={Trash2} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></>}>
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/15"><AlertTriangle size={19} /></span>
        <div className="text-sm text-slate-600 dark:text-slate-300">{message}</div>
      </div>
    </Modal>
  );
}

/* Read-only details pop-up: label/value grid plus optional extra content */
export function DetailModal({ open, onClose, title, subtitle, fields = [], children, width = 'max-w-xl' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={width}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {fields.filter(Boolean).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.03]">
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">{k}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{v ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
      {children && <div className={fields.length ? 'mt-5' : ''}>{children}</div>}
    </Modal>
  );
}
