# @byteoniclabs/intake

Official lightweight client library to easily send form submissions securely to Byteonic Intake.
Works with **Vanilla JS** or **React**.

## Installation

```bash
npm install @byteoniclabs/intake
# or
yarn add @byteoniclabs/intake
# or
pnpm add @byteoniclabs/intake
```

## React Usage

The easiest way to use Intake in React is via our native hooks.

### 1. Simple Form Hook

```tsx
import { useByteonicIntake } from '@byteoniclabs/intake/react';

export default function ContactForm() {
  // Pass your publishable API key and form slug
  const { submit, isLoading, isSuccess, error } = useByteonicIntake({
    formSlug: 'contact-form',
    apiKey: 'YOUR_PUBLISHABLE_API_KEY',
  });

  if (isSuccess) {
    return <div>Thanks for reaching out!</div>;
  }

  return (
    <form onSubmit={submit}>
      <input type="text" name="name" required placeholder="Name" />
      <input type="email" name="email" required placeholder="Email" />
      <textarea name="message" required placeholder="Message"></textarea>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

### 2. Global Provider (Optional)

If you have multiple forms across your site, you can set the API key globally.

```tsx
// App.tsx
import { ByteonicProvider } from '@byteoniclabs/intake/react';

export default function App({ children }) {
  return (
    <ByteonicProvider apiKey="YOUR_PUBLISHABLE_API_KEY">
      {children}
    </ByteonicProvider>
  );
}

// AnyComponent.tsx
import { useByteonicIntake } from '@byteoniclabs/intake/react';

// Now you only need the formSlug
const { submit } = useByteonicIntake('contact-form');
```

## Vanilla JS Usage

If you're not using React, you can import the core client and use it anywhere.

```javascript
import { ByteonicClient } from '@byteoniclabs/intake';

const client = new ByteonicClient({ apiKey: 'YOUR_PUBLISHABLE_API_KEY' });

const myForm = document.getElementById('my-form');

myForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // You can pass a FormData object directly!
  const formData = new FormData(myForm);
  
  const response = await client.submit('contact-form', formData);
  
  if (response.success) {
    alert('Form submitted successfully!');
  } else {
    console.error('Submission failed', response.error);
  }
});
```

## Features

- Zero Configuration: Connects directly to Byteonic Intake's API.
- FormData Support: Automatically digests native HTML `FormData` elements.
- Full TypeScript support out of the box.
- Built for modern ESM & CJS.

---

*Built by [Byteonic Labs](https://byteoniclabs.com)*
