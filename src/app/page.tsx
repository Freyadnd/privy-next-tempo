"use client";

import {
  ActionButtonsGrid,
  BalanceCard,
  BatchSendModal,
  ChatModal,
  LoginView,
  ReceiveModal,
  RecentActivity,
  SendModal,
  SkeletonView,
  UserPill,
  WalletContainer,
  WalletHeader,
} from "@/components";
import { useSend } from "@/hooks/useSend";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { useBalance } from "@/hooks/useBalance";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

export default function Home() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showBatchSend, setShowBatchSend] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [memo, setMemo] = useState("");

  // Use the Privy embedded wallet, not MetaMask
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet?.address || "";
  const { balance, symbol, loading } = useBalance(walletAddress);
  const { send, isSending, error, txHash, reset } = useSend();
  const {
    transactions: txHistory,
    loading: txLoading,
    error: txError,
  } = useTransactionHistory(walletAddress, txHash || undefined);

  // Format transaction history for display
  const transactions = txHistory.map((tx) => ({
    type: tx.type,
    amount: tx.amount,
    timestamp: tx.formattedTimestamp,
    hash: tx.hash,
    memo: tx.memo,
  }));

  const handleSend = async () => {
    try {
      await send(recipient, sendAmount, memo);
    } catch (err) {
      // Error is already handled by the hook
      console.error("Send failed:", err);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(walletAddress);
  };

  return (
    <>
      {!authenticated && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <SkeletonView />
        </div>
      )}
      <AnimatePresence>
        {ready && !authenticated && <LoginView onLogin={login} />}
      </AnimatePresence>
      <AnimatePresence>
        {authenticated && (
          <>
            <UserPill />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="relative z-10 w-full"
            >
              <WalletContainer>
                <WalletHeader />
                <BalanceCard
                  balance={balance}
                  symbol={symbol}
                  walletAddress={walletAddress}
                  onCopyAddress={copyToClipboard}
                  loading={loading}
                />
                <ActionButtonsGrid
                  onSendClick={() => setShowSend(true)}
                  onReceiveClick={() => setShowReceive(true)}
                  onBatchClick={() => setShowBatchSend(true)}
                  onChatClick={() => setShowChat(true)}
                />
                <RecentActivity
                  transactions={transactions}
                  loading={txLoading}
                  error={txError}
                  symbol={symbol}
                />
              </WalletContainer>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <SendModal
        isOpen={showSend}
        onClose={() => {
          setShowSend(false);
          reset();
          setSendAmount("");
          setRecipient("");
          setMemo("");
        }}
        recipientAddress={recipient}
        onRecipientChange={setRecipient}
        amount={sendAmount}
        onAmountChange={setSendAmount}
        memo={memo}
        onMemoChange={setMemo}
        onConfirm={handleSend}
        isSending={isSending}
        error={error}
        txHash={txHash}
      />
      <ReceiveModal
        isOpen={showReceive}
        onClose={() => setShowReceive(false)}
        walletAddress={walletAddress}
        onCopyAddress={copyToClipboard}
      />
      <BatchSendModal
        isOpen={showBatchSend}
        onClose={() => setShowBatchSend(false)}
      />
      <ChatModal isOpen={showChat} onClose={() => setShowChat(false)} />
    </>
  );
}
