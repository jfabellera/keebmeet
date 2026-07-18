import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { FiCheck, FiLink } from 'react-icons/fi';
import { toast } from 'sonner';

interface CopyLinkButtonProps {
  slug: string;
  className?: string;
}

export const CopyLinkButton = ({
  slug,
  className,
}: CopyLinkButtonProps): ReactNode => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const handleCopyLink = (event: MouseEvent): void => {
    // Cards wrap the button in a click handler; don't trigger it.
    event.stopPropagation();
    const url = `${window.location.origin}/meetup/${slug}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      title="Copy link"
      aria-label="Copy link"
      onClick={handleCopyLink}
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
            key="link"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <FiLink />
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
};
