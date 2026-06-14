'use client';

import React, { useState } from 'react';
import { StaffActionPendingContext } from './ActionSubmitButton';

export type StaffActionFeedbackState = {
  status: 'idle' | 'success' | 'error' | 'unchanged';
  message: string;
};

type StaffActionFormProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'> & {
  action: (state: StaffActionFeedbackState, formData: FormData) => Promise<StaffActionFeedbackState>;
  children: React.ReactNode;
  currentRating?: string | null;
  noChangeMessage?: string;
};

const initialState: StaffActionFeedbackState = { status: 'idle', message: '' };

export function StaffActionForm({ action, children, currentRating, noChangeMessage, ...props }: StaffActionFormProps) {
  const [state, setState] = useState<StaffActionFeedbackState>(initialState);
  const [pending, setPending] = useState(false);

  return (
    <form
      {...props}
      onSubmit={async (event) => {
        event.preventDefault();
        setState(initialState);
        const nativeEvent = event.nativeEvent as SubmitEvent;
        const submitter = nativeEvent.submitter;
        const formData = new FormData(event.currentTarget);
        if (submitter instanceof HTMLButtonElement && submitter.name) {
          formData.set(submitter.name, submitter.value);
        }
        if (
          currentRating &&
          submitter instanceof HTMLButtonElement &&
          submitter.name === 'action' &&
          submitter.value === 'change'
        ) {
          const selectedRating = String(formData.get('rating') ?? '').trim();
          if (selectedRating === currentRating) {
            const label = selectedRating ? selectedRating[0].toUpperCase() + selectedRating.slice(1) : 'current rating';
            setState({
              status: 'unchanged',
              message: noChangeMessage ?? `Already set to ${label} — no change made.`,
            });
            return;
          }
        }

        setPending(true);
        try {
          setState(await action(initialState, formData));
        } catch {
          setState({ status: 'error', message: 'Action failed. Nothing was recorded; please try again.' });
        } finally {
          setPending(false);
        }
      }}
    >
      <StaffActionPendingContext.Provider value={pending}>{children}</StaffActionPendingContext.Provider>
      {state.message ? (
        <p className={`status-feedback status-feedback--${state.status}`} role={state.status === 'error' ? 'alert' : 'status'}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
