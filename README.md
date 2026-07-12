# Inletbase

The official, lightweight client library to easily send form submissions and integrate real-time AI Chatbots securely into your **Inletbase** projects. Works seamlessly with **Vanilla JS**, **React**, and **Node.js** backends.

## Installation

```bash
npm install inletbase
# or
yarn add inletbase
# or
pnpm add inletbase
```

---

## 1. Forms (React & Vanilla JS)

The easiest way to use Inletbase forms in React is via our native hooks.

### React: Simple Form Hook

`useInletbase` accepts **either** a form slug string (`useInletbase('contact-form')`) **or** an options object (`useInletbase({ formSlug, apiKey?, baseUrl? })`). Use the object form when you want to pass the API key or a custom `baseUrl` inline.

```tsx
import { useInletbase } from 'inletbase/react';

export default function ContactForm() {
  // Pass your publishable API key and form slug
  const { submit, isLoading, isSuccess, error } = useInletbase({
    formSlug: 'contact-form',
    apiKey: 'YOUR_PUBLISHABLE_API_KEY', // You can also set VITE_INLETBASE_API_KEY / NEXT_PUBLIC_INLETBASE_API_KEY
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

### React: Set your API key once with a Provider

Wrap your app (or any subtree) in `InletbaseProvider` to supply the API key (and an optional `baseUrl`) in one place. Any `useInletbase('slug')` call rendered inside the provider automatically uses that key, so you don't have to pass `apiKey` to every hook.

```tsx
import { InletbaseProvider, useInletbase, useInletbaseClient } from 'inletbase/react';

function App() {
  return (
    <InletbaseProvider apiKey="YOUR_PUBLISHABLE_API_KEY">
      <ContactForm />
    </InletbaseProvider>
  );
}

function ContactForm() {
  // No apiKey here — it is resolved from the surrounding provider.
  const { submit, isLoading, error } = useInletbase('contact-form');

  return (
    <form onSubmit={submit}>
      <input type="email" name="email" required placeholder="Email" />
      <button type="submit" disabled={isLoading}>Send</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

Need the underlying client to submit imperatively? Grab it with `useInletbaseClient()` (must be called inside an `InletbaseProvider`):

```tsx
import { useInletbaseClient } from 'inletbase/react';

function useContactSubmit() {
  const client = useInletbaseClient();
  return (data: Record<string, any>) => client.submit('contact-form', data);
}
```

> **Key resolution order:** the hooks resolve the API key from, in order, the value passed to the hook → the `InletbaseProvider` → `NEXT_PUBLIC_INLETBASE_API_KEY` → `VITE_INLETBASE_API_KEY`. The first non-empty value wins.

### React: Spam Protection (Honeypot)

Prevent bot spam effortlessly without annoying CAPTCHAs. Just drop `<InletbaseHoneypot />` anywhere inside your `<form>`! It renders an invisible input field that tricks bots into filling it out.

```tsx
import { useInletbase, InletbaseHoneypot } from 'inletbase/react';

export default function SafeForm() {
  const { submit } = useInletbase('contact-form');

  return (
    <form onSubmit={submit}>
      <input type="text" name="name" placeholder="Name" />
      {/* Invisible to humans, catches bots automatically */}
      <InletbaseHoneypot />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Vanilla JS Usage

If you're not using React, import the core client and use it anywhere. It automatically parses `FormData`.

```javascript
import { InletbaseClient } from 'inletbase';

const client = new InletbaseClient({ apiKey: 'YOUR_PUBLISHABLE_API_KEY' });
const myForm = document.getElementById('my-form');

myForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Pass the FormData object directly!
  const response = await client.submit('contact-form', new FormData(myForm));

  if (response.success) {
    alert('Success!');
  }
});
```

---

## 2. AI Chatbot (React)

Deploy a fully customized, real-time AI Support Chatbot with built-in streaming directly into your UI.

> **No API key required for chat.** The chat backend (both `InletbaseChatClient` and the `useInletbaseChatbot` hook) authenticates via **Origin_Auth**: it validates the request `Origin` and the `chatbot_id` against the bot's allowed domains configured in your Inletbase dashboard. There is no `Authorization`/API key check for chat, so you only need your bot ID. (An `apiKey` may still be passed for backward compatibility, but it is ignored by the backend.) Forms, by contrast, still require a publishable API key.

```tsx
import { useState } from 'react';
import { useInletbaseChatbot } from 'inletbase/react';

export default function SupportChat() {
  const {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    streamedMessage,
    config,
    clearHistory,
    error        // set when the bot config fails to load (e.g. Origin not allowed)
  } = useInletbaseChatbot({
    botId: 'YOUR_BOT_ID'
    // No apiKey needed — chat authenticates by Origin against the bot's allowed domains.
  });

  const [input, setInput] = useState('');

  return (
    <div className="chat-container">
      {/* 1. Display chat history (automatically saved to localStorage!) */}
      {messages.map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'user-bubble' : 'bot-bubble'}>
          {m.content}
        </div>
      ))}

      {/* 2. Display real-time streaming text as the AI types */}
      {isStreaming && streamedMessage && (
        <div className="bot-bubble streaming-effect">
          {streamedMessage} <span className="cursor-blink">|</span>
        </div>
      )}

      {/* 3. Send messages */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); setInput(''); }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask me anything..." />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

The `config` object returned by `useInletbaseChatbot` contains the chatbot's appearance settings (`welcome_message`, `widget_title`, `primary_color`, `bot_avatar`, `suggestions`, and more) as configured in your Inletbase dashboard.

### Error & empty-response handling

`sendMessage` never throws — the hook manages failures for you:

- **Config load failure** (for example, the request `Origin` isn't in the bot's allowed domains → HTTP `403`) is surfaced through the `error` field returned by the hook.
- **Empty responses**: if the model completes but returns no text, that turn is treated as a failure — the hook appends a friendly *"No response was generated. Please try again."* message instead of rendering a blank bubble.
- **Generation/network failures** append a fallback assistant message so the conversation stays usable.

### Vanilla JS: Chat Client (without React)

Not using React? Use `InletbaseChatClient` directly to load the bot's config and stream a reply.

```javascript
import { InletbaseChatClient } from 'inletbase';

const chat = new InletbaseChatClient(); // No API key — chat uses Origin_Auth.

// 1. Load appearance config (resolves to the config object, or null if none exists).
const config = await chat.getConfig('YOUR_BOT_ID');

// 2. Stream a response.
const result = await chat.generate(
  'YOUR_BOT_ID',
  'session-123',                 // any stable id for the conversation
  'Hello!',                      // the user's message
  [],                            // prior history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  { onChunk: (full) => console.log(full) } // called with the running accumulated text as it streams
);

if (result.success) {
  console.log('Final reply:', result.message);
} else {
  console.error('Chat failed:', result.error);
}
```

- **`getConfig(botId)`** resolves to the config object, or `null` when the bot has none. It **throws** on a non-2xx response (e.g. a `403` when the Origin isn't allowed), so wrap it in `try/catch`. The client instance stays usable after a rejection.
- **`generate(botId, sessionId, message, history, options?)`** resolves to `{ success, message?, error? }` and does **not** throw. A non-2xx status, a dropped connection, or an empty stream resolves with `success: false` and an `error`; on success, `message` holds the final accumulated reply. Pass `options.onChunk` to receive the running text as it streams.

---

## 3. Node.js Server SDK

If you are handling form submissions on your own backend (like Next.js API Routes, Express, or Fastify) and want to securely proxy the data to Inletbase without exposing your API keys, use the Server SDK.

**Features:**
- Securely spoofs the Origin domain to safely bypass strict whitelisting rules.
- Forwards user IP addresses to Inletbase for accurate analytics.

```typescript
import { InletbaseServerClient } from 'inletbase/server';

export async function POST(request) {
  const body = await request.json();

  // Create client with your private API key
  const client = new InletbaseServerClient({
    apiKey: process.env.INLETBASE_PRIVATE_API_KEY,
    origin: 'https://my-website.com' // Legally bypass domain whitelisting
  });

  const response = await client.submit('contact-form', body, {
    userIp: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
    sourceUrl: 'Backend API Submission'
  });

  return Response.json(response);
}
```

---

## Form Response Contract

Both form clients — `InletbaseClient` (browser/vanilla + the `useInletbase` hook) and `InletbaseServerClient` (Node.js) — return the **same** response envelope. Neither client throws across this boundary: every outcome (success, non-2xx, and network/timeout failure) resolves to this shape.

```ts
interface ResponseEnvelope {
  success: boolean;  // true only when the HTTP status is 200–299
  status: number;    // the numeric HTTP status code; 0 on a network/timeout failure
  data: any;         // the backend response body (or { error } on a failure)
  error?: string;    // present on failure; mirrors the backend error message
}
```

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` when the HTTP status is in the 200–299 range, otherwise `false`. |
| `status` | `number` | The numeric HTTP status code returned by the backend. On a network error or timeout (before any HTTP response is received) this is `0`. |
| `data` | `any` | The parsed backend response body on success or non-2xx responses. On a network/timeout failure it is `{ error }`. |
| `error` | `string` (optional) | Present when the request fails; mirrors the backend error message (or the network/timeout message). |

**Backward compatibility:** any top-level fields returned by the backend are also spread onto the envelope, so existing code that reads a field directly off the result (for example `response.id` or `response.message`) keeps working. The canonical `success`, `status`, and `data` fields always take precedence if a backend field shares the same name.

```ts
const response = await client.submit('contact-form', data);

if (response.success) {
  // 2xx — use response.data (and any spread top-level fields)
} else if (response.status === 0) {
  // network error or timeout — inspect response.error
} else {
  // non-2xx HTTP status — response.status / response.error describe the problem
}
```

---

## Configuration

Both clients accept an optional `baseUrl` if you need to point at a custom deployment. The defaults are:

| Client | Default `baseUrl` |
|---|---|
| `InletbaseClient` / `InletbaseServerClient` (forms) | `https://inletbase.com/api/external` |
| `InletbaseChatClient` (chatbot) | `https://api.inletbase.com/api/v1/chat` |

Environment variables recognized by the React hooks:

- `NEXT_PUBLIC_INLETBASE_API_KEY` (Next.js)
- `VITE_INLETBASE_API_KEY` (Vite)

---

## Features

- **Zero Configuration**: Connects directly to Inletbase's API.
- **Real-Time Streaming**: Handles complex SSE JSON chunking securely.
- **LocalStorage Sync**: The React Chatbot automatically persists user conversations securely.
- **FormData Support**: Automatically digests native HTML `<form>` elements.
- **Full TypeScript** support out of the box.

*Built by [Byteonic Labs](https://byteoniclabs.com)*
