# Tempo + Privy Example Project

A wallet app on [Tempo](https://tempo.xyz) using [Privy](https://privy.io) for embedded wallet authentication. Demonstrates token transfers, batch sends, and a **pay-per-prompt AI chat** powered by [Machine Payments Protocol (MPP)](https://mpp.dev) — where each message costs 0.01 aUSD settled on-chain instantly.

## Features

- **Privy Authentication**: Embedded wallet creation via email or SMS — no seed phrases
- **Token Transfers**: Send alphaUSD to wallet addresses, emails, or phone numbers
- **Batch Sends**: Send to up to 5 recipients in a single atomic transaction
- **Transaction Memos**: Attach human-readable notes to transfers (TIP-20)
- **Pay-per-prompt AI Chat**: Each message costs 0.01 aUSD, paid automatically on-chain via MPP's HTTP 402 flow

## Tech Stack

- [Next.js](https://nextjs.org) 15 with App Router
- [Tempo SDK](https://www.npmjs.com/package/tempo.ts) (`tempo.ts`)
- [Privy](https://privy.io) for wallet management
- [mppx](https://mpp.dev) for HTTP 402 machine payments
- [Viem](https://viem.sh) for Ethereum interactions
- [TailwindCSS](https://tailwindcss.com) for styling

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

```env
# Privy — https://dashboard.privy.io
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=

# AI Chat (pay-per-prompt via MPP)
OPENAI_API_KEY=          # OpenAI key for chat responses
MERCHANT_WALLET_ADDRESS= # 0x address that receives 0.01 aUSD per message
MPP_SECRET_KEY=          # from https://mpp.dev — used to sign/verify 402 challenges
```

3. Run the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) and log in to get your embedded wallet. Fund it with testnet aUSD from the [Tempo faucet](https://faucet.tempo.xyz).

---

## Key Implementation Details

### How Privy Is Used

Privy provides two key functions in this app:

**1. Sender Wallet (always used)**

When you log in via email or SMS, Privy automatically creates an embedded wallet. No seed phrases or extensions needed. This wallet signs all transactions.

**2. Recipient Lookup (optional)**

| Recipient Type | Example | How it works |
|---|---|---|
| Wallet address | `0x1234...abcd` | Sends directly |
| Email | `friend@example.com` | Privy looks up or creates their wallet |
| Phone | `+14155551234` | Privy looks up or creates their wallet |

When sending to an email or phone, Privy either finds the recipient's existing wallet or creates a new one. The recipient logs in with that email/phone to access their funds.

**Server-side lookup** lives in `src/app/api/find/route.ts` using `@privy-io/node`:

```ts
const user = await privy.users().getByEmailAddress({ address: email })
  ?? await privy.users().create({ linked_accounts: [{ type: 'email', address: email }], wallets: [{ chain_type: 'ethereum' }] })
```

### Transaction Memos

Memos are attached to transfers using the `memo` parameter (TIP-20). The field is `bytes32`, so encode carefully:

```ts
// User-provided memo
memo: stringToHex(memo, { size: 32 })

// No memo, wallet address recipient — pad the address to 32 bytes
memo: padHex(recipientAddress, { size: 32 })

// No memo, email/phone recipient — encode the string
memo: stringToHex(recipientIdentifier, { size: 32 })
```

### Pay-per-prompt AI Chat (MPP)

This is the core showcase. Every chat message triggers an on-chain payment before the AI responds — no API keys, no Stripe, instant settlement on Tempo.

#### How the 402 payment flow works

```
Client                          Server (/api/chat)
  │                                   │
  │── POST /api/chat ────────────────>│
  │                                   │ no credential → return 402
  │<── 402 + WWW-Authenticate ────────│
  │                                   │
  │  [parse challenge]                │
  │  [transferSync 0.01 aUSD]         │
  │  [build credential from tx hash]  │
  │                                   │
  │── POST /api/chat + Authorization ─>│
  │                                   │ verify tx on-chain → call OpenAI
  │<── 200 + AI reply ────────────────│
```

#### Server: gate the endpoint with mppx

```ts
// src/app/api/chat/route.ts
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY!,
  methods: [tempo({
    testnet: true,
    currency: '0x20c0000000000000000000000000000000000001', // alphaUSD
    recipient: process.env.MERCHANT_WALLET_ADDRESS as `0x${string}`,
  })],
})

export async function POST(request: Request) {
  const result = await mppx.charge({ amount: '0.01' })(request)
  if (result.status === 402) return result.challenge

  const { messages } = await request.json()
  const reply = await callOpenAI(messages)
  return result.withReceipt(Response.json({ reply }))
}
```

#### Client: handle 402 manually with Privy wallet

mppx's built-in client modes (`push`/`pull`) are incompatible with Privy embedded wallets on Tempo — push uses `wallet_sendCalls` (rejected by Tempo RPC) and pull uses `eth_signTransaction` (unsupported by Privy for Tempo's custom tx type). So the 402 flow is handled manually:

```ts
// src/hooks/useChat.ts
async function pay402(response: Response, wallet): Promise<string> {
  const challenge = Challenge.fromResponse(response)
  const { amount, currency, recipient } = challenge.request

  // Use the same transferSync pattern that works everywhere else in the app
  const { receipt } = await client.token.transferSync({
    to: recipient,
    amount: BigInt(amount), // already in smallest units from the challenge
    token: currency,
  })

  // Serialize into the mppx credential format
  return Credential.serialize({
    challenge,
    payload: { hash: receipt.transactionHash, type: 'hash' },
    source: `did:pkh:eip155:42431:${wallet.address}`,
  })
}

// In sendMessage:
let response = await fetch('/api/chat', { method: 'POST', body })
if (response.status === 402) {
  const credential = await pay402(response, wallet)
  response = await fetch('/api/chat', {
    method: 'POST',
    headers: { Authorization: credential },
    body,
  })
}
```

The server verifies the credential by looking up the tx hash on-chain and confirming the transfer amount and recipient match the challenge.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts        # 402-gated AI endpoint (mppx)
│   │   ├── find/route.ts        # Privy email/phone → wallet address
│   │   └── transactions/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ChatModal.tsx            # Pay-per-prompt chat UI
│   ├── SendModal.tsx
│   ├── BatchSendModal.tsx
│   └── ...
├── hooks/
│   ├── useChat.ts               # Manual MPP 402 flow
│   ├── useSend.ts               # Single token transfer
│   ├── useBatchSendRaw.ts       # Batch transfer
│   └── useBalance.ts
└── providers/
    └── PrivyProvider.tsx        # Privy + React Query setup
```

## Resources

- [Tempo Documentation](https://docs.tempo.xyz)
- [Privy Documentation](https://docs.privy.io)
- [Machine Payments Protocol](https://mpp.dev)
- [Viem Documentation](https://viem.sh)
