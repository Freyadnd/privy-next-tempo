"use client";

import { alphaUsd } from "@/constants";
import { useWallets } from "@privy-io/react-auth";
import { Challenge, Credential } from "mppx";
import { useCallback, useState } from "react";
import { tempoActions } from "tempo.ts/viem";
import {
  createWalletClient,
  custom,
  defineChain,
  walletActions,
  type Address,
} from "viem";

const tempoModerato = defineChain({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
  feeToken: alphaUsd,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useChat() {
  const { wallets } = useWallets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay402 = useCallback(
    async (response: Response): Promise<string> => {
      const wallet = wallets.find((w) => w.walletClientType === "privy");
      if (!wallet) throw new Error("No Privy embedded wallet found");

      await wallet.switchChain(tempoModerato.id);
      const provider = await wallet.getEthereumProvider();

      const challenge = Challenge.fromResponse(response);
      const { amount, currency, recipient } = challenge.request as {
        amount: string;
        currency: Address;
        recipient: Address;
      };

      const client = createWalletClient({
        account: wallet.address as Address,
        chain: tempoModerato,
        transport: custom(provider),
      })
        .extend(walletActions)
        .extend(tempoActions());

      const { receipt } = await client.token.transferSync({
        to: recipient,
        amount: BigInt(amount),
        token: currency,
      });

      return Credential.serialize({
        challenge,
        payload: { hash: receipt.transactionHash, type: "hash" },
        source: `did:pkh:eip155:${tempoModerato.id}:${wallet.address}`,
      });
    },
    [wallets]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      setIsLoading(true);
      setError(null);

      const userMessage: ChatMessage = { role: "user", content };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);

      try {
        const body = JSON.stringify({ messages: nextMessages });

        // First attempt — no credential
        let response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        // 402 — pay and retry once
        if (response.status === 402) {
          const credential = await pay402(response);
          response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: credential,
            },
            body,
          });
        }

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`);
        }

        const data = (await response.json()) as { reply: string };
        setMessages([
          ...nextMessages,
          { role: "assistant", content: data.reply },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send message"
        );
        setMessages(messages);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, pay402]
  );

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    reset: () => {
      setMessages([]);
      setError(null);
    },
  };
}
