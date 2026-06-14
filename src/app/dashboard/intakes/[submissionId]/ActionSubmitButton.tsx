'use client';

import React, { createContext, useContext, useState } from 'react';

type ActionSubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
};

export const StaffActionPendingContext = createContext<boolean | undefined>(undefined);

export function ActionSubmitButton({ children, pendingLabel = 'Saving…', disabled = false, ...props }: ActionSubmitButtonProps) {
  const formPending = useContext(StaffActionPendingContext);
  const [localPending, setLocalPending] = useState(false);
  const pending = formPending ?? localPending;
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      data-pending-label={pendingLabel}
      onClick={() => {
        if (formPending === undefined) setLocalPending(true);
      }}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
