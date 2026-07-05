import { cn } from '@/lib/utils';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import BarcodeScanner from 'react-qr-barcode-scanner';

const SCAN_COOLDOWN_MS = 1000;

const CORNER_CLASSES = [
  'top-0 left-0 rounded-tl-lg border-t-6 border-l-6',
  'top-0 right-0 rounded-tr-lg border-t-6 border-r-6',
  'bottom-0 left-0 rounded-bl-lg border-b-6 border-l-6',
  'right-0 bottom-0 rounded-br-lg border-r-6 border-b-6',
] as const;

interface QrScannerProps {
  onScan: (value: string) => void;
}

const QrScanner = ({ onScan }: QrScannerProps): ReactNode => {
  const [isCoolingDown, setIsCoolingDown] = useState<boolean>(false);
  const cooldownRef = useRef<boolean>(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginCooldown = (): void => {
    cooldownRef.current = true;
    setIsCoolingDown(true);
    if (cooldownTimerRef.current != null) {
      clearTimeout(cooldownTimerRef.current);
    }
    cooldownTimerRef.current = setTimeout(() => {
      cooldownRef.current = false;
      cooldownTimerRef.current = null;
      setIsCoolingDown(false);
    }, SCAN_COOLDOWN_MS);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current != null) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-muted relative aspect-square w-full max-w-lg overflow-hidden rounded-md">
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading camera...</p>
      </div>
      <div className="absolute inset-0 z-10">
        <BarcodeScanner
          width="100%"
          height="100%"
          onUpdate={(_, result) => {
            if (result) {
              if (cooldownRef.current) {
                beginCooldown();
                return;
              }
              onScan(result.getText());
              beginCooldown();
            }
          }}
          videoConstraints={{
            aspectRatio: 1,
            facingMode: 'environment',
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="relative aspect-square w-2/3">
            {CORNER_CLASSES.map((corner) => (
              <div
                key={corner}
                className={cn(
                  'absolute h-8 w-8 transition-colors',
                  corner,
                  isCoolingDown ? 'border-green-500' : 'border-secondary'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QrScanner;
