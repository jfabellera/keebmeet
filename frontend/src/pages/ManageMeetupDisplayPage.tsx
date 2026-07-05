import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ReactNode, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';

export const ManageMeetupDisplayPage = (): ReactNode => {
  const { meetupId } = useParams();
  const [copied, setCopied] = useState(false);
  const [interval, setInterval] = useState<number>(15);
  const navigate = useNavigate();

  const displayUrl = `${window.location.origin}/meetup/${meetupId}/display?interval=${interval}`;

  const handleCopyClick = (): void => {
    navigator.clipboard.writeText(displayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex justify-center p-4">
      <Card className="w-full max-w-3xl p-4">
        <h1 className="text-2xl font-bold">Display</h1>
        <Field>
          <Label htmlFor="interval">Idle Image Interval (seconds)</Label>
          <Input
            id="interval"
            type="number"
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
          />
        </Field>

        <Field>
          <Label>
            Copy the link below to share the display. This link can be used on
            any device without requiring a login.
          </Label>
          <div className="relative">
            <Input
              readOnly
              value={displayUrl}
              className="font-mono text-sm pr-10"
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyClick}
              aria-label="Copy display link"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            >
              {copied ? <FiCheck /> : <FiCopy />}
            </Button>
          </div>
        </Field>

        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">or</span>
          <span className="bg-border h-px flex-1" />
        </div>

        <Button
          onClick={() =>
            void navigate(`/meetup/${meetupId}/display?interval=${interval}`)
          }
        >
          Go to display
        </Button>
      </Card>
    </div>
  );
};
