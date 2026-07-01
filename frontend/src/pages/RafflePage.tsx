import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/lib/utils';
import { useFormik } from 'formik';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { FiSettings } from 'react-icons/fi';
import { MdHistory } from 'react-icons/md';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type RaffleRecordResponse } from '@keebmeet/shared';
import RaffleHistoryList from '../components/RafflePage/RaffleHistoryList';
import { socket } from '../socket';
import {
  useClaimRaffleWinnerMutation,
  useGetRaffleRecordQuery,
  useMarkRaffleAsDisplayedMutation,
  useRollRaffleWinnerMutation,
  useUnClaimRaffleWinnerMutation,
} from '../store/organizerSlice';

type StateColor = 'green' | 'black' | 'red' | 'yellow';

const colorClass = (color: StateColor): string =>
  ({
    green: 'bg-green-600 text-white hover:bg-green-700',
    black:
      'bg-muted-foreground/50 text-background hover:bg-muted-foreground/90',
    red: 'bg-destructive text-white hover:bg-destructive/90',
    yellow: 'bg-yellow-400 text-black hover:bg-yellow-500',
  })[color];

const RafflePage = (): ReactNode => {
  const { meetupId: meetupIdParam } = useParams();
  const meetupId = parseInt(meetupIdParam ?? '');
  const [
    rollRaffleWinner,
    {
      isSuccess: isRollSuccess,
      isError: isRollError,
      isLoading: isRollLoading,
      data: rollResult,
    },
  ] = useRollRaffleWinnerMutation();
  const [
    claimRaffleWinner,
    {
      isSuccess: isClaimSuccess,
      isError: isClaimError,
      isLoading: isClaimLoading,
    },
  ] = useClaimRaffleWinnerMutation();
  const [
    unclaimRaffleWinner,
    {
      isSuccess: isUnClaimSuccess,
      isError: isUnClaimError,
      isLoading: isUnClaimLoading,
    },
  ] = useUnClaimRaffleWinnerMutation();
  const [markRaffleAsDisplayed] = useMarkRaffleAsDisplayedMutation();

  const [raffleRecordId, setRaffleRecordId] = useState<number | null>(null);
  const [isDisplayed, setIsDisplayed] = useState<boolean>(false);
  const [isAllIn, setIsAllIn] = useState<boolean>(false);
  const { data: getRaffleRecordResult } = useGetRaffleRecordQuery(
    raffleRecordId ?? 0,
    { skip: raffleRecordId == null }
  );
  const [raffleRecord, setRaffleRecord] = useState<RaffleRecordResponse | null>(
    null
  );
  const [isRollable, setIsRollable] = useState<boolean>(true);
  const [losers, setLosers] = useState<string[] | null>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isHistoryOpen,
    onOpen: onHistoryOpen,
    onClose: onHistoryClose,
  } = useDisclosure();
  const formik = useFormik({
    initialValues: {
      rollQuantity: 1,
      displayOnRoll: false,
      clearOnClaim: false,
      includeNotCheckedIn: false,
    },
    onSubmit: () => {},
  });

  const handleRoll = (): void => {
    void (async () => {
      await rollRaffleWinner({
        meetupId,
        payload: {
          quantity: formik.values.rollQuantity,
          includeNotCheckedIn: formik.values.includeNotCheckedIn,
        },
      });
    })();
    setIsAllIn(false);
  };

  const handleRollAllIn = (): void => {
    void (async () => {
      await rollRaffleWinner({
        meetupId,
        payload: {
          allIn: true,
          includeNotCheckedIn: formik.values.includeNotCheckedIn,
        },
      });
      onClose();
      setIsAllIn(true);
    })();
  };

  const handleClaim = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const winnerIndex = Number(event.currentTarget.id);
    void (async () => {
      if (raffleRecordId != null && raffleRecord != null) {
        await claimRaffleWinner({
          ticketId: raffleRecord.winners[winnerIndex].ticketId,
          payload: { raffleRecordId: Number(raffleRecord.id), force: isAllIn }, // TODO(jan): id is a string
        });
      }
    })();
  };

  const handleUnclaim = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const winnerIndex = Number(event.currentTarget.id);
    void (async () => {
      if (raffleRecordId != null && raffleRecord != null) {
        await unclaimRaffleWinner({
          raffleRecordId: raffleRecord.id,
          payload: {
            ticketId: Number(raffleRecord.winners[winnerIndex].ticketId),
          }, // TODO(jan): id is a string
        });
      }
    })();
  };

  const handleDisplay = (): void => {
    if (raffleRecord != null && raffleRecordId != null) {
      socket.emit('meetup:display', {
        meetupId,
        winners: raffleRecord.winners.map((winner) => winner.displayName),
        losers,
        isBatchRoll: raffleRecord.winners.length > 1,
      });
      setIsDisplayed(true);
      void (async () => {
        await markRaffleAsDisplayed(raffleRecordId);
      })();
    }
  };

  const handleClear = (): void => {
    setRaffleRecordId(null);
    setLosers(null);
    setIsDisplayed(false);
    setIsAllIn(false);
    setIsRollable(true);
    socket.emit('meetup:display', { meetupId, winner: null });
  };

  const handleRaffleRecordSelect = (raffleRecordId: number): void => {
    setRaffleRecordId(raffleRecordId);
    setIsRollable(true);
    onHistoryClose();
  };

  useEffect(() => {
    if (formik.values.displayOnRoll) {
      handleDisplay();
    }
  }, [raffleRecord]);

  useEffect(() => {
    if (getRaffleRecordResult == null) return;

    setRaffleRecord(getRaffleRecordResult);
  }, [getRaffleRecordResult]);

  useEffect(() => {
    if (isRollSuccess) {
      if (rollResult == null) {
        toast.warning('Roll failed', {
          description: 'No eligible attendees',
          position: 'top-center',
        });
      } else {
        setRaffleRecordId(Number(rollResult.raffleRecord.id)); // TODO(jan): shouldn't have to cast
        setRaffleRecord(rollResult.raffleRecord);
        setLosers(rollResult.losers);

        if (rollResult.raffleRecord.winners.length === 1) setIsRollable(false);
      }
    }
  }, [isRollSuccess, rollResult]);

  useEffect(() => {
    if (isClaimSuccess && raffleRecord != null) {
      toast.success('Success', {
        description: 'Raffle claimed',
        position: 'top-center',
      }); // TODO(jan): Include claimer's name

      if (formik.values.clearOnClaim) {
        handleClear();
      }

      setIsAllIn(false);
      setIsRollable(true);
    }
  }, [isClaimSuccess]);

  useEffect(() => {
    if (isUnClaimSuccess) {
      toast.success('Success', {
        description: 'Raffle unclaimed',
        position: 'top-center',
      });
    }
  }, [isUnClaimSuccess]);

  useEffect(() => {
    if (isRollError || isClaimError || isUnClaimError) {
      toast.error('Error', {
        description: 'Action failed',
        position: 'top-center',
      });
    }
  }, [isRollError, isClaimError, isUnClaimError]);

  const isBatch = raffleRecord != null && raffleRecord.winners.length > 1;

  return (
    <div className="flex h-full justify-center">
      <div className="flex h-full w-full max-w-[800px] flex-col gap-4 p-4">
        <div className="w-full grow overflow-scroll text-center">
          {raffleRecordId != null &&
          raffleRecord != null &&
          raffleRecordId === Number(raffleRecord.id) && // TODO(jan): id is a string
          raffleRecord.winners.length > 0 ? (
            raffleRecord.winners.length > 1 ? (
              <div>
                {/* Display for batch roll */}
                <p>WINNERS</p>
                <div className="flex flex-col gap-2">
                  {raffleRecord.winners.map((winner, index) => {
                    return (
                      <div
                        key={index}
                        className="flex w-full flex-row justify-between text-left"
                      >
                        <p className="line-clamp-1 min-w-0 text-2xl break-all">
                          {`${index + 1}. ${winner.displayName}`}
                        </p>
                        <Button
                          className={colorClass(
                            raffleRecord.winners != null && isDisplayed
                              ? 'green'
                              : 'black'
                          )}
                          id={String(index)}
                          onClick={
                            !winner.claimed ? handleClaim : handleUnclaim
                          }
                          disabled={isClaimLoading || isUnClaimLoading}
                        >
                          {!winner.claimed ? 'Claim' : 'Unclaim'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                {/* Display for single person roll */}
                <p>WINNER</p>
                <p className="text-5xl font-medium break-all">
                  {raffleRecord.winners[0].displayName ?? ''}
                </p>
                <p className="mt-1">
                  {raffleRecord.winners[0].firstName}{' '}
                  {raffleRecord.winners[0].lastName}
                </p>
                {raffleRecord.winners[0].wins > 0 ? (
                  <p className="text-destructive">
                    {raffleRecord.winners[0].wins} win
                    {raffleRecord.winners[0].wins > 1 ? 's' : null}
                  </p>
                ) : null}
              </div>
            )
          ) : (
            <p className="leading-[6rem]">Click roll to select a winner</p>
          )}
        </div>
        <div className="flex w-full items-center justify-evenly">
          <Button variant="ghost" onClick={onHistoryOpen}>
            <MdHistory />
            Raffle history
          </Button>
          <Button variant="ghost" onClick={onOpen}>
            <FiSettings />
            More options
          </Button>
        </div>
        <div
          className={cn(
            'grid w-full grid-cols-2 gap-2',
            isBatch
              ? '[grid-template-rows:repeat(2,100px)]'
              : '[grid-template-rows:repeat(3,100px)]'
          )}
        >
          <div className="col-span-2">
            <Button
              className={cn(
                'flex size-full flex-col',
                colorClass(isRollable ? 'green' : 'black')
              )}
              onClick={handleRoll}
              disabled={!isRollable || isRollLoading}
            >
              {isRollLoading ? <Loader2 className="animate-spin" /> : null}
              <span className="text-2xl font-medium">
                Roll{' '}
                {formik.values.rollQuantity > 1
                  ? formik.values.rollQuantity
                  : null}
              </span>
              {formik.values.displayOnRoll ? (
                <span className="text-sm">and display</span>
              ) : null}
            </Button>
          </div>
          <div className={isBatch ? 'col-span-1' : 'col-span-2'}>
            <Button
              className={cn(
                'size-full',
                colorClass(
                  raffleRecordId != null && !isDisplayed && !isRollable
                    ? 'green'
                    : 'black'
                )
              )}
              onClick={handleDisplay}
              disabled={raffleRecordId == null}
            >
              <span className="text-2xl font-medium">Display</span>
            </Button>
          </div>
          {raffleRecord == null || raffleRecord.winners.length === 1 ? (
            <div className="col-span-1">
              <Button
                className={cn(
                  'size-full',
                  colorClass(
                    raffleRecordId != null && isDisplayed ? 'green' : 'black'
                  )
                )}
                id={'0'}
                onClick={
                  !(raffleRecord?.winners[0].claimed ?? false)
                    ? handleClaim
                    : handleUnclaim
                }
                disabled={
                  raffleRecordId == null || isClaimLoading || isUnClaimLoading
                }
              >
                <span className="text-2xl font-medium">
                  {!(raffleRecord?.winners[0].claimed ?? false)
                    ? 'Claim'
                    : 'Unclaim'}
                </span>
              </Button>
            </div>
          ) : null}
          <div className="col-span-1">
            <Button
              className={cn(
                'size-full',
                colorClass(
                  !isRollable && isDisplayed
                    ? 'red'
                    : isDisplayed
                      ? 'yellow'
                      : 'black'
                )
              )}
              onClick={handleClear}
            >
              <span className="text-2xl font-medium">Clear</span>
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Options</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-6 px-4 pb-4">
            {/* TODO(jan): Implement logic */}
            <Field>
              <FieldLabel htmlFor="rollQuantity">Roll quantity</FieldLabel>
              <Input
                id="rollQuantity"
                type="number"
                inputMode="numeric"
                value={formik.values.rollQuantity}
                onChange={formik.handleChange}
              />
            </Field>

            <div className="flex items-center gap-3">
              <Label htmlFor="displayOnRoll" className="mb-0">
                Display on roll
              </Label>
              <Switch
                id="displayOnRoll"
                checked={formik.values.displayOnRoll}
                onCheckedChange={(checked) => {
                  void formik.setFieldValue('displayOnRoll', checked);
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="clearOnClaim" className="mb-0">
                Clear on claim
              </Label>
              <Switch
                id="clearOnClaim"
                checked={formik.values.clearOnClaim}
                onCheckedChange={(checked) => {
                  void formik.setFieldValue('clearOnClaim', checked);
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="includeNotCheckedIn" className="mb-0">
                Include not checked-in
              </Label>
              <Switch
                id="includeNotCheckedIn"
                checked={formik.values.includeNotCheckedIn}
                onCheckedChange={(checked) => {
                  void formik.setFieldValue('includeNotCheckedIn', checked);
                }}
              />
            </div>

            <div className="w-full">
              <Button
                className="bg-destructive hover:bg-destructive/90 h-12 w-full text-white"
                onClick={handleRollAllIn}
                disabled={raffleRecordId != null}
              >
                Roll all in
              </Button>
              <p className="mt-1 text-center">
                Previous winners are eligible to win
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isHistoryOpen}
        onOpenChange={(open) => {
          if (!open) onHistoryClose();
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Raffle history</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <RaffleHistoryList
              meetupId={Number(meetupId)}
              onCardClick={handleRaffleRecordSelect}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default RafflePage;
