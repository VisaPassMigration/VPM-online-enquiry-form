'use client';

import React, { useState } from 'react';

type ActionSubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
};

export function ActionSubmitButton({ children, pendingLabel = 'Saving…', disabled = false, ...props }: ActionSubmitButtonProps) {
  const [pending, setPending] = useState(false);
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      data-pending-label={pendingLabel}
      onClick={() => setPending(true)}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
