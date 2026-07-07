import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { type RaffleRecordResponse } from '@keebmeet/shared';
import dayjs from 'dayjs';
import RelativeTime from 'dayjs/plugin/relativeTime';
import { useEffect, useState, type ReactNode } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { toast } from 'sonner';
import { useDeleteRaffleRecordMutation } from '../../store/organizerSlice';
import { Button } from '../ui/button';

dayjs.extend(RelativeTime);

interface Props extends React.ComponentProps<'div'> {
  raffleRecord: RaffleRecordResponse;
  onCardClick: (raffleRecordId: string) => void;
}

const RaffleHistoryCard = ({
  raffleRecord,
  onCardClick,
  className,
  ...rest
}: Props): ReactNode => {
  const [deleteRaffleRecord, { isLoading: isDeleting }] =
    useDeleteRaffleRecordMutation();

  const [isOpen, setIsOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isBatchRoll = raffleRecord.winners.length > 1;
  const claimedCount = raffleRecord.winners.filter(
    (winner) => winner.claimed
  ).length;
  const hasWarning = claimedCount > 0 || raffleRecord.wasDisplayed;

  const handleOpenChange = (open: boolean): void => {
    setIsOpen(open);
    if (open) setCooldown(hasWarning ? 3 : 0);
  };

  // Cooldown timer for delete confirmation
  useEffect(() => {
    if (!isOpen || cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [isOpen, cooldown]);

  const handleClick = (): void => {
    onCardClick(raffleRecord.id);
  };

  const handleDelete = async (): Promise<void> => {
    try {
      await deleteRaffleRecord(raffleRecord.id).unwrap();
    } catch {
      toast.error('Error', {
        description: 'Failed to delete raffle roll',
        position: 'top-center',
      });
    }
  };

  return (
    <div
      className={cn(
        'bg-card text-card-foreground flex w-full cursor-pointer flex-col gap-2 rounded-md p-4 shadow-sm',
        className
      )}
      onClick={handleClick}
      {...rest}
    >
      <div className="flex justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {raffleRecord.wasDisplayed ? (
            <Badge className="bg-yellow-400 text-black">Displayed</Badge>
          ) : (
            <Badge className="bg-gray-300 text-black">Not Displayed</Badge>
          )}
          <p className="italic">
            {dayjs(raffleRecord.createdAt).fromNow(true)} ago
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isDeleting}
              onClick={(e) => e.stopPropagation()}
            >
              <FiX />
            </Button>
          </DialogTrigger>
          {/* Stop card-selection clicks from firing while interacting with the dialog. */}
          <DialogContent
            onClick={(e) => e.stopPropagation()}
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle>Delete this raffle roll?</DialogTitle>
              <DialogDescription>
                This permanently removes the roll and its{' '}
                {raffleRecord.winners.length}{' '}
                {raffleRecord.winners.length === 1 ? 'winner' : 'winners'}. This
                can&apos;t be undone.
              </DialogDescription>
              {claimedCount > 0 ? (
                <div className="border-destructive/50 bg-destructive/10 text-destructive mt-2 flex items-start gap-2 rounded-md border p-3 text-sm">
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  <p>
                    {isBatchRoll
                      ? `${claimedCount} of these winners have`
                      : 'This winner has'}{' '}
                    already claimed{' '}
                    {claimedCount === 1 ? 'their win' : 'their wins'}. Deleting
                    this roll may make them eligible for future rolls.
                  </p>
                </div>
              ) : null}
              {raffleRecord.wasDisplayed ? (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  <p>
                    This roll has already been shown on the display for
                    attendees to see.
                  </p>
                </div>
              ) : null}
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  disabled={cooldown > 0}
                  onClick={() => void handleDelete()}
                >
                  {cooldown > 0 ? `Delete (${cooldown})` : 'Delete'}
                  {isDeleting && <Spinner />}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-col gap-1.5">
        {raffleRecord.winners.map((winner, index) => (
          <div key={index} className="flex justify-between">
            <p className="line-clamp-1">{winner.displayName}</p>
            {winner.claimed ? (
              <Badge className="bg-green-500 text-white">Claimed</Badge>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RaffleHistoryCard;
