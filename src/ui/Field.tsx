import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}

export function FieldShell({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextField({ label, hint, error, value, onChange, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy }) => (
        <input
          id={id}
          className="input"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextArea({ label, hint, error, value, onChange, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          className="input"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

interface SelectFieldProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({ label, hint, error, value, options, onChange, ...rest }: SelectFieldProps<T>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy }) => (
        <select
          id={id}
          className="input"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value as T)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="checkbox">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

/** Interruptor (sí/no) con texto, cómodo de pulsar. */
export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </label>
  );
}
