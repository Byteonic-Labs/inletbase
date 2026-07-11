# inletbase

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
    clearHistory
  } = useInletbaseChatbot({
    botId: 'YOUR_BOT_ID',
    apiKey: 'YOUR_PUBLISHABLE_API_KEY'
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
