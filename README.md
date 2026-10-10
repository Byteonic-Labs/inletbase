# Inletbase

The official client library for **Inletbase**. Send form submissions (including file uploads) and drop a real-time AI chatbot into your site with almost no code. Works with **plain JavaScript**, **React**, and **Node.js** servers.

Two things to know up front:

- **Forms** need a **publishable API key** (sent as a bearer token).
- **Chat** needs **no API key**. The chat backend checks the website domain the request comes from (its `Origin`) against the list of allowed domains you set in your Inletbase dashboard, so you only supply your bot ID.

## Installation

```bash
npm install inletbase
# or
yarn add inletbase
# or
pnpm add inletbase
```

---

## Forms

### React: the `useInletbaseForm` hook

`useInletbaseForm` accepts **either** a form-slug string (`useInletbaseForm('contact-form')`) **or** an options object (`useInletbaseForm({ formSlug, apiKey? })`). Use the object form when you want to pass the API key inline.

```tsx
import { useInletbaseForm } from 'inletbase/react';

export default function ContactForm() {
  const { submit, isLoading, isSuccess, error } = useInletbaseForm({
    formSlug: 'contact-form',
    apiKey: 'YOUR_PUBLISHABLE_API_KEY', // or supply it once via InletbaseProvider
  });

  if (isSuccess) {
    return <div>Thanks for reaching out!</div>;
  }

  return (
    <form onSubmit={submit}>
      <input type="text" name="name" required placeholder="Name" />
      <input type="email" name="email" required placeholder="Email" />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

The hook returns:

| Field | Type | Description |
|---|---|---|
| `submit` | `(data) => Promise<ResponseEnvelope>` | Pass an `onSubmit` event, a `FormData` object, or a plain object. |
| `isLoading` | `boolean` | `true` while a submission is in flight. |
| `isSuccess` | `boolean` | `true` after a successful (2xx) submission. |
| `error` | `string \| null` | An error message when the submission fails, otherwise `null`. |
| `response` | `ResponseEnvelope \| null` | The full backend response for the last submission (see below). `null` before you submit. |

#### Reading the raw response body

The `response` field holds the complete backend response as a `ResponseEnvelope` (described in [Form response shape](#form-response-shape)). Read the raw body from `response.data`:

```tsx
import { useInletbaseForm } from 'inletbase/react';

export default function ContactForm() {
  const { submit, response } = useInletbaseForm('contact-form');

  return (
    <form onSubmit={submit}>
      <input type="email" name="email" required placeholder="Email" />
      <button type="submit">Send</button>

      {response?.success && (
        // response.data is the exact body the backend returned
        <pre>{JSON.stringify(response.data, null, 2)}</pre>
      )}
    </form>
  );
}
```

### React: set your API key once with a Provider

Wrap your app (or any part of it) in `InletbaseProvider` to supply the API key in one place. Any `useInletbaseForm('slug')` call rendered inside the provider uses that key automatically, so you don't have to pass `apiKey` to every hook.

```tsx
import { InletbaseProvider, useInletbaseForm } from 'inletbase/react';

function App() {
  return (
    <InletbaseProvider apiKey="YOUR_PUBLISHABLE_API_KEY">
      <ContactForm />
    </InletbaseProvider>
  );
}

function ContactForm() {
  // No apiKey here — it comes from the surrounding provider.
  const { submit, isLoading, error } = useInletbaseForm('contact-form');

  return (
    <form onSubmit={submit}>
      <input type="email" name="email" required placeholder="Email" />
      <button type="submit" disabled={isLoading}>Send</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

Need the underlying client so you can call `submit` yourself? Get it with `useInletbaseFormClient()` (must be called inside an `InletbaseProvider`):

```tsx
import { useInletbaseFormClient } from 'inletbase/react';

function useContactSubmit() {
  const client = useInletbaseFormClient();
  return (data: Record<string, any>) => client.submit('contact-form', data);
}
```

> **Key resolution order:** the hooks look for the API key in this order — the value passed to the hook → the `InletbaseProvider`. The first non-empty value wins. If neither supplies a key, `submit` returns an error.

### React: spam protection (honeypot)

Drop `<InletbaseFormHoneypot />` anywhere inside your `<form>` to catch bots without a CAPTCHA. It renders a hidden input that humans never see; if a bot fills it in, Inletbase ignores the submission.

```tsx
import { useInletbaseForm, InletbaseFormHoneypot } from 'inletbase/react';

export default function SafeForm() {
  const { submit } = useInletbaseForm('contact-form');

  return (
    <form onSubmit={submit}>
      <input type="text" name="name" placeholder="Name" />
      <InletbaseFormHoneypot />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Vanilla JavaScript

Not using React? Import `InletbaseFormClient` and use it anywhere. It reads native `FormData` directly.

```javascript
import { InletbaseFormClient } from 'inletbase';

const client = new InletbaseFormClient({ apiKey: 'YOUR_PUBLISHABLE_API_KEY' });
const myForm = document.getElementById('my-form');

myForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const response = await client.submit('contact-form', new FormData(myForm));

  if (response.success) {
    alert('Success!');
    console.log('Backend returned:', response.data);
  } else {
    alert(response.error);
  }
});
```

### File uploads

Inletbase forms accept file uploads with **no extra setup**. Any `File` or `Blob`
you include in a submission is sent along with the other fields — this works with
the React hook, the vanilla `InletbaseFormClient`, and the Node.js server client.

**React (file input):** just add a file `<input>` to your form. The hook builds
`FormData` from the form element, so the file is picked up automatically.

```tsx
import { useInletbaseForm } from 'inletbase/react';

export default function ApplicationForm() {
  const { submit, isLoading, isSuccess, error } = useInletbaseForm('job-application');

  if (isSuccess) return <div>Application received!</div>;

  return (
    <form onSubmit={submit}>
      <input type="text" name="name" required placeholder="Name" />

      {/* a single file */}
      <input type="file" name="resume" required />

      {/* multiple files under one field name become an array */}
      <input type="file" name="attachments" multiple />

      <button type="submit" disabled={isLoading}>Apply</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

**Plain object or `FormData`:** pass `File`/`Blob` values directly — either
top-level or inside an array. Non-file fields are sent unchanged.

```ts
import { InletbaseFormClient } from 'inletbase';

const client = new InletbaseFormClient({ apiKey: 'YOUR_PUBLISHABLE_API_KEY' });

// From a plain object
await client.submit('job-application', {
  name: 'Ada Lovelace',
  resume: fileInput.files[0],   // a File
  attachments: [file1, file2],  // an array of Files -> stored as multiple files
});

// …or straight from a <form>
await client.submit('job-application', new FormData(formEl));
```

**How it works:** the SDK encodes each `File`/`Blob` into a base64 payload and
submits the whole form as JSON (the shape the Inletbase backend stores), so you
never handle multipart yourself. A few things to keep in mind:

- Base64 adds roughly **33%** to a file's size, so keep uploads within your
  plan's storage limits. A submission that exceeds your organization's storage
  quota is rejected with a non-2xx status (see [Form response shape](#form-response-shape)).
- Works in the browser and in **Node.js 18+** (which provides `File`/`Blob`), so
  the server client below can send files too.
- Repeated `FormData` keys and array values collapse into an array of files
  under one field.

### Node.js server

Handling submissions on your own backend (Next.js route handlers, Express, Fastify) and want to keep your key off the client? Use `InletbaseFormServerClient` from `inletbase/server`. It can forward the visitor's IP and user agent for accurate analytics, and can set the request origin to match a strict domain allow-list.

```typescript
import { InletbaseFormServerClient } from 'inletbase/server';

export async function POST(request) {
  const body = await request.json();

  const client = new InletbaseFormServerClient({
    apiKey: process.env.INLETBASE_PRIVATE_API_KEY,
    origin: 'https://my-website.com', // match your dashboard's allowed domains
  });

  const response = await client.submit('contact-form', body, {
    userIp: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
    sourceUrl: 'Backend API Submission',
  });

  return Response.json(response);
}
```

### Form response shape

Every form client — `InletbaseFormClient` (browser + the `useInletbaseForm` hook) and `InletbaseFormServerClient` (Node.js) — returns the **same** response, and none of them throw. Success, a non-2xx status, and a network/timeout failure all resolve to this shape, called a `ResponseEnvelope`:

```ts
interface ResponseEnvelope {
  success: boolean;  // true only when the HTTP status is 200–299
  status: number;    // the HTTP status code; 0 on a network or timeout failure
  data: any;         // the backend response body (or { error } on a failure)
  error?: string;    // present on failure; mirrors the backend error message
}
```

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` when the status is 200–299, otherwise `false`. |
| `status` | `number` | The HTTP status code. `0` when the request failed before any response arrived (network error or timeout). |
| `data` | `any` | The parsed backend body. On a network/timeout failure it is `{ error }`. |
| `error` | `string` (optional) | Present on failure; the backend or network error message. |

Any top-level fields the backend returns are also copied onto the envelope, so older code that reads a field straight off the result (for example `response.id` or `response.message`) keeps working. The `success`, `status`, and `data` fields always win if a backend field shares one of those names.

```ts
const response = await client.submit('contact-form', data);

if (response.success) {
  // 2xx — the raw body is in response.data
} else if (response.status === 0) {
  // network error or timeout — see response.error
} else {
  // non-2xx status — response.status and response.error describe the problem
}
```

---

## Chatbot

The chatbot is a **hosted widget**: the full chat experience (launcher, message
history, streaming replies, file attachments, input, and send) lives on the
Inletbase backend and is served as a single script. This package doesn't
reimplement it — the React component and the `<script>` tag simply **load the
hosted widget** for your bot ID, so it always stays up to date without you
upgrading the SDK. Appearance (title, welcome message, colors, avatar,
suggestions, position) comes from your dashboard config.

Chat needs **no API key**: the backend authorizes each request by matching the
website domain it came from against your bot's allowed domains.

### React: the `InletbaseChatbot` component

```tsx
import { InletbaseChatbot } from 'inletbase/react';

export default function App() {
  return (
    <>
      {/* your app */}
      <InletbaseChatbot botId="YOUR_BOT_ID" />
    </>
  );
}
```

The component renders no DOM of its own: on mount it injects the hosted widget
script, and on unmount it removes the script and the widget. It is SSR-safe (it
only loads in the browser).

Props:

| Prop | Type | Description |
|---|---|---|
| `botId` | `string` | Your chatbot's ID. Required. |
| `baseUrl` | `string` (optional) | Override the backend origin that hosts the widget. Defaults to `https://api.inletbase.com`. |
| `apiKey` | `string` (optional) | Accepted for backward compatibility, but the chat backend ignores it (Origin_Auth). |

### Any website: the `<script>` tag (no build step)

For plain HTML, embed the hosted widget script directly:

```html
<script
  src="https://api.inletbase.com/widget/chatbot.js"
  data-chatbot-id="YOUR_BOT_ID"
  async
></script>
```

The `unpkg` URL from earlier versions still works and now simply forwards to the
hosted widget above (it reads `data-chatbot-id` and injects the backend script):

```html
<script
  src="https://unpkg.com/inletbase/dist/widget/inletbase-chat.js"
  data-chatbot-id="YOUR_BOT_ID"
  async
></script>
```

| Attribute | Required | Description |
|---|---|---|
| `data-chatbot-id` | yes | Your chatbot's ID. Without it the widget reports an error and does not mount. |

If the config fails to load (e.g. the current domain isn't in the bot's allowed
list), the widget does not mount.

> **Note (2.0.2):** the chat widget is now backend-hosted. The
> `InletbaseChatbot` `className`/`style` props were removed (the widget mounts
> its own fixed container), and the chat client classes are no longer exported.
> Forms are unchanged.

## Authentication

- **Forms** require a publishable API key, sent as `Authorization: Bearer <key>`. Supply it directly to `useInletbaseForm` / `InletbaseFormClient` / `InletbaseFormServerClient`, or once via `InletbaseProvider`.
- **Chat** requires **no** API key. The backend matches the request's website domain against your bot's allowed domains. Any `apiKey` you pass to the `InletbaseChatbot` component is accepted for backward compatibility but ignored by the backend.

---

## What's exported

- **`inletbase`** — `InletbaseFormClient`.
- **`inletbase/react`** — `useInletbaseForm`, `InletbaseProvider`, `useInletbaseFormClient`, `InletbaseFormHoneypot`, `InletbaseChatbot`.
- **`inletbase/server`** — `InletbaseFormServerClient` (forms only).
- **Hosted chat widget** — the `InletbaseChatbot` React component and the
  `<script>` tag both load the backend-hosted widget (`api.inletbase.com/widget/chatbot.js`);
  the `unpkg` `dist/widget/inletbase-chat.js` URL forwards to it.

---

*Built by [Byteonic Labs](https://byteoniclabs.com)*
