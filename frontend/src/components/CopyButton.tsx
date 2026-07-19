import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { type IconType } from 'react-icons';
import { toast } from 'sonner';

interface CopyButtonProps {
  // The exact text written to the clipboard.
  value: string;
  // Toast shown on success; omit to suppress the toast.
  toastMessage?: string;
  // Accessible label / tooltip for the button.
  label?: string;
  // Idle-state icon; swaps to a check while copied.
  icon?: IconType;
  className?: string;
}

export const CopyButton = ({
  value,
  toastMessage = 'Copied to clipboard',
  label = 'Copy',
  icon: Icon = FiCopy,
  className,
}: CopyButtonProps): ReactNode => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const handleCopy = (event: MouseEvent): void => {
    // Callers may wrap the button in a click handler (e.g. cards); don't
    // trigger it.
    event.stopPropagation();
    void navigator.clipboard.writeText(value);
    setCopied(true);
    if (toastMessage != null) toast.success(toastMessage);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={handleCopy}
      className={className}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 1000, damping: 50 }}
          >
            <FiCheck className="text-green-600" />
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <Icon />
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
};
