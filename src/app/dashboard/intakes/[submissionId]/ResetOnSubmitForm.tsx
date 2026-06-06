'use client';

import React, { useRef, useState, type FormHTMLAttributes, type ReactNode } from 'react';

type ResetOnSubmitFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'children'> & {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  successMessage?: string;
};

export default function ResetOnSubmitForm({ action, children, successMessage = 'Action recorded. Fields cleared for the next note.', ...props }: ResetOnSubmitFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      {...props}
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        props.onSubmit?.(event);
        if (event.defaultPrevented) return;
        window.setTimeout(() => {
          formRef.current?.reset();
          setSubmitted(true);
        }, 0);
      }}
    >
      {children}
      <p className="form-success-feedback" aria-live="polite">{submitted ? successMessage : ''}</p>
    </form>
  );
}
