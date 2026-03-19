import { alphaUsd } from "@/constants";
import { useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { tempoActions } from "tempo.ts/viem";
import {
  createWalletClient,
  createPublicClient,
  custom,
  defineChain,
  http,
  parseUnits,
  isAddress,
  padHex,
  stringToHex,
  walletActions,
  type Address,
} from "viem";

// Define Tempo Moderato chain
const tempoModerato = defineChain({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
  feeToken: alphaUsd,
});

export function useSend() {
  const { wallets } = useWallets();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const send = async (to: string, amount: string, memo: string = "") => {
    if (isSending) return;
    setIsSending(true);
    setError(null);
    setTxHash(null);

    // Use the Privy embedded wallet, not MetaMask
    const wallet = wallets.find((w) => w.walletClientType === "privy");
    if (!wallet?.address) {
      const errMsg = "No Privy embedded wallet found";
      setError(errMsg);
      setIsSending(false);
      throw new Error(errMsg);
    }

    try {
      // Switch wallet to Tempo Moderato chain
      await wallet.switchChain(tempoModerato.id);

      const provider = await wallet.getEthereumProvider();

      // Use HTTP transport for reads (doesn't depend on wallet's chain)
      const publicClient = createPublicClient({
        chain: tempoModerato,
        transport: http("https://rpc.moderato.tempo.xyz"),
      }).extend(tempoActions());

      const client = createWalletClient({
        account: wallet.address as Address,
        chain: tempoModerato,
        transport: custom(provider),
      })
        .extend(walletActions)
        .extend(tempoActions());

      const metadata = await publicClient.token.getMetadata({
        token: alphaUsd,
      });
      const recipient = await getAddress(to);
      const { receipt } = await client.token.transferSync({
        to: recipient,
        amount: parseUnits(amount, metadata.decimals),
        memo: memo
          ? stringToHex(memo, { size: 32 })
          : isAddress(to)
            ? padHex(to, { size: 32 })
            : stringToHex(to, { size: 32 }),
        token: alphaUsd,
      });

      setTxHash(receipt.transactionHash);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send";
      setError(errorMessage);
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  return {
    send,
    isSending,
    error,
    txHash,
    reset: () => {
      setError(null);
      setTxHash(null);
    },
  };
}

async function getAddress(to: string): Promise<Address> {
  const res = await fetch("/api/find", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier: to }),
  });

  if (!res.ok) {
    throw new Error("Failed to find user");
  }

  const data = (await res.json()) as { address: Address };
  return data.address;
}
