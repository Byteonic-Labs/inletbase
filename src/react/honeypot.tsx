import React from 'react';

/**
 * A hidden input field used to trick bots into filling it out.
 * If this field is submitted, Inletbase will ignore the submission, protecting you from spam.
 *
 * Simply place `<InletbaseHoneypot />` anywhere inside your `<form>` element.
 */
export function InletbaseHoneypot() {
  return (
    <div style={{ display: 'none', position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true">
      <label htmlFor="_gotcha">Please leave this field blank</label>
      <input type="text" name="_gotcha" id="_gotcha" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
