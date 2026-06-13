'use client';

import React, { type ReactNode } from 'react';
import { useFormStatus as reactUseFormStatus } from 'react-dom';

type LeadRatingSubmitButtonProps = {
  actionValue: 'suggest' | 'confirm' | 'change';
  children: ReactNode;
  className: string;
  pendingLabel: string;
};

export function LeadRatingSubmitButton({ actionValue, children, className, pendingLabel }: LeadRatingSubmitButtonProps) {
  const useFormStatus = typeof reactUseFormStatus === 'function' ? reactUseFormStatus : undefined;
  const { pending } = useFormStatus?.() ?? { pending: false };

  return (
    <button className={className} type="submit" name="action" value={actionValue} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
