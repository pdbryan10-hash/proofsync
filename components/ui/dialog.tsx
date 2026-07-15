'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={cn('relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-fade-in', className)}>
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-navy-800" aria-label="Close">
          <X className="size-4" />
        </button>
        <h2 className="text-lg font-semibold text-navy-800">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
