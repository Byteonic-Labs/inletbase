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
      {/*
        Hardened against false positives: browsers and password managers
        (1Password, LastPass, Bitwarden, etc.) will otherwise autofill hidden
        text inputs, which populates the honeypot and makes the backend silently
        drop a legitimate submission. The ignore hints below tell those tools to
        skip this field, and `autoComplete="off"` / `tabIndex={-1}` keep the
        browser and keyboard away from it.
      */}
      <input
        type="text"
        name="_gotcha"
        id="_gotcha"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        data-form-type="other"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
      />
    </div>
  );
}
