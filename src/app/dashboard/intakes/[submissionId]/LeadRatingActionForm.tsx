'use client';

import React, { type ReactNode } from 'react';
import { useFormState as reactUseFormState } from 'react-dom';

type LeadRatingActionState = { notice?: string } | null;

type LeadRatingActionFormProps = {
  action: (state: LeadRatingActionState | FormData, formData?: FormData) => Promise<LeadRatingActionState | void>;
  children: ReactNode;
};

export function LeadRatingActionForm({ action, children }: LeadRatingActionFormProps) {
  const useFormState = typeof reactUseFormState === 'function' ? reactUseFormState : undefined;
  const [state, formAction] = (useFormState?.(action as never, null) ?? [null, action]) as [LeadRatingActionState, typeof action];

  return (
    <form action={formAction} className="intake-form">
      {state?.notice ? <p className="success-message" role="status">{state.notice}</p> : null}
      {children}
    </form>
  );
}
