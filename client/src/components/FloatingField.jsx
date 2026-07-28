import { useState } from 'react';

// Floating-label input; password type gets a show/hide toggle.
export default function FloatingField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  error,
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className={`ff ${error ? 'ff-invalid' : ''}`}>
      <input
        id={id}
        className="ff-input"
        type={inputType}
        value={value}
        onChange={onChange}
        placeholder=" "
        autoComplete={autoComplete}
        spellCheck="false"
      />
      <label htmlFor={id} className="ff-label">
        {label}
      </label>
      {isPassword && (
        <button
          type="button"
          className="ff-eye"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? '🙈' : '👁️'}
        </button>
      )}
    </div>
  );
}
