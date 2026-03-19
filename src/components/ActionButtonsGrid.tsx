import { motion } from "motion/react";
import { ActionButton } from "./ActionButton";

interface ActionButtonsGridProps {
  onSendClick: () => void;
  onReceiveClick: () => void;
  onBatchClick?: () => void;
  onChatClick?: () => void;
}

export function ActionButtonsGrid({
  onSendClick,
  onReceiveClick,
  onBatchClick,
  onChatClick,
}: ActionButtonsGridProps) {
  const buttons = [
    { type: "send" as const, onClick: onSendClick, x: -10, y: 0 },
    { type: "receive" as const, onClick: onReceiveClick, x: 10, y: 0 },
    { type: "batch" as const, onClick: onBatchClick || (() => {}), x: -10, y: 0 },
    { type: "chat" as const, onClick: onChatClick || (() => {}), x: 10, y: 0 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="grid grid-cols-2 gap-4 mb-12"
    >
      {buttons.map((btn, i) => (
        <motion.div
          key={btn.type}
          initial={{ opacity: 0, x: btn.x }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 + i * 0.05 }}
        >
          <ActionButton type={btn.type} onClick={btn.onClick} />
        </motion.div>
      ))}
    </motion.div>
  );
}
