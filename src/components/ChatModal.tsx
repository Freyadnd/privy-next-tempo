"use client";

import { useChat } from "@/hooks/useChat";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COST_PER_MESSAGE = "0.01";

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const { messages, sendMessage, isLoading, error, reset } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleClose = () => {
    reset();
    setInput("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    setInput("");
    await sendMessage(content);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Chat">
      <div className="flex flex-col" style={{ height: "420px" }}>
        {/* Cost badge */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-xs px-2 py-1 rounded-full"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            {COST_PER_MESSAGE} aUSD / message · paid via mppx
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
          {messages.length === 0 && (
            <p
              className="text-sm text-center mt-8"
              style={{ color: "var(--text-tertiary)" }}
            >
              Each message costs {COST_PER_MESSAGE} aUSD, paid automatically
              on-chain.
            </p>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] rounded-lg px-3 py-2 text-sm"
                  style={
                    msg.role === "user"
                      ? {
                          background: "rgba(255,255,255,0.12)",
                          color: "var(--text-primary)",
                        }
                      : {
                          background: "var(--glass-bg)",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-tertiary)",
                }}
              >
                paying &amp; waiting...
              </div>
            </motion.div>
          )}

          {error && (
            <p className="text-xs text-center" style={{ color: "#ff6b6b" }}>
              {error}
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            disabled={isLoading}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-lg px-4 py-2 text-sm transition-opacity"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
              opacity: !input.trim() || isLoading ? 0.4 : 1,
            }}
          >
            Send
          </button>
        </form>
      </div>
    </Modal>
  );
}
