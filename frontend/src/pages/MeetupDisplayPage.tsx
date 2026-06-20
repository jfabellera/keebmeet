import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
} from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import useMeasure from 'react-use-measure';
import { socket } from '../socket';
import { useGetMeetupDisplayAssetsQuery } from '../store/meetupSlice';

// Durstenfeld shuffle taken from https://stackoverflow.com/a/12646864
const shuffleArray = (array: any[]): any[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const MeetupDisplayPage = (): ReactNode => {
  const { meetupId } = useParams();
  const [displayState, setDisplayState] = useState<'idle' | 'raffle winner'>(
    'idle'
  );
  const [raffleType, setRaffleType] = useState<'single' | 'batch'>('single');
  const { data: displayAssets } = useGetMeetupDisplayAssetsQuery(
    Number(meetupId)
  );
  const [idleImageIndex, setIdleImageIndex] = useState<number>(0);
  const [winners, setWinners] = useState<string[] | null>(null);
  const [losers, setLosers] = useState<string[] | null>(null);

  const [ref, { height }] = useMeasure();
  const yTranslation = useMotionValue(0);

  // TODO(jan): Handle this better
  // Prevent raffle text from showing up for a split second before animating
  const [raffleWinnerActive, setRaffleWinnerActive] = useState<boolean>(true);

  useEffect(() => {
    socket.emit('meetup:subscribe', { meetupId: Number(meetupId) });
    // Resubscribe on reconnection after losing connection
    socket.on('connect', () => {
      socket.emit('meetup:subscribe', { meetupId: Number(meetupId) });
    });

    socket.on('meetup:display', (payload) => {
      setRaffleWinnerActive(false);

      setWinners(payload.winners);
      setLosers(payload.losers);
      setRaffleType(payload.isBatchRoll === true ? 'batch' : 'single');
      if (payload.winners != null) {
        setDisplayState('raffle winner');
      } else {
        setDisplayState('idle');
      }
    });
  }, []);

  useEffect(() => {
    if (
      displayAssets?.idleImageUrls == null ||
      displayAssets.idleImageUrls.length <= 1
    )
      return;

    // If there are multiple images, cycle through them periodically
    const intervalId = setInterval(() => {
      // Don't change image if display is idle
      if (displayState !== 'idle') return;

      const idleImageCount = displayAssets.idleImageUrls?.length ?? 0;

      setIdleImageIndex(
        (previousIndex) => (previousIndex + 1) % idleImageCount
      );
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [displayAssets, displayState]);

  useEffect(() => {
    if (height === 0) return;
    if (winners == null) return;

    const initialY = -height;
    const finalY = 72;

    setRaffleWinnerActive(true);

    void (async () => {
      await animate(yTranslation, [initialY, finalY], {
        // ease: 'backOut',
        type: 'spring',
        // stiffness: 20,
        // mass: 10,
        damping: 50,
      });
    })();
  }, [yTranslation, height, winners]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black text-white">
      {displayState === 'raffle winner' &&
      winners != null &&
      winners.length > 0 ? (
        raffleType === 'batch' ? (
          <>
            {displayAssets?.batchRaffleWinnerBackgroundImageUrl != null ? (
              <img
                className="size-full bg-black object-contain"
                src={displayAssets.batchRaffleWinnerBackgroundImageUrl}
                loading={'eager'}
                alt=""
              />
            ) : null}

            <div className="absolute top-[15%] flex h-[80%] w-2/3 items-center justify-center overflow-clip p-8">
              <div className="grid w-full grid-flow-col [grid-template-columns:repeat(2,auto)] [grid-template-rows:repeat(10,auto)] gap-2">
                {winners.map((winner, index) => {
                  return (
                    <div key={index} className="w-full text-left">
                      <p
                        className="line-clamp-1 min-w-0 leading-normal break-all"
                        style={{
                          fontSize:
                            // Handle font size for different amount of winners
                            (5 / Math.min(Math.max(winners.length, 5), 10)) *
                            120,
                        }}
                      >
                        {`${index + 1}. ${winner}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {displayAssets?.raffleWinnerBackgroundImageUrl != null ? (
              <img
                className="size-full bg-black object-contain"
                src={displayAssets?.raffleWinnerBackgroundImageUrl ?? ''}
                loading={'eager'}
                alt=""
              />
            ) : null}
            <div className="absolute h-1/3 w-2/3 overflow-clip">
              <motion.div
                style={{
                  width: '100%',
                  textAlign: 'center',
                  y: yTranslation,
                  opacity: raffleWinnerActive ? 1 : 0,
                }}
              >
                <div
                  className="absolute flex w-full flex-col items-center gap-5"
                  ref={ref}
                >
                  <p className="line-clamp-1 text-[144px] break-all">
                    {winners[0]}
                  </p>
                  {losers != null
                    ? shuffleArray(losers).map((loser, index) => (
                        <p
                          key={index}
                          className="line-clamp-1 text-[144px] break-all"
                        >
                          {loser}
                        </p>
                      ))
                    : null}
                </div>
              </motion.div>
            </div>
          </>
        )
      ) : displayAssets?.idleImageUrls != null &&
        displayAssets.idleImageUrls.length > 0 ? (
        <AnimatePresence mode={'sync'}>
          <motion.img
            key={idleImageIndex}
            src={displayAssets.idleImageUrls[idleImageIndex]}
            loading={'eager'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              position: 'absolute',
              zIndex: 1,
            }}
          />
          <img
            className="absolute size-full object-contain"
            src={displayAssets.idleImageUrls[idleImageIndex]}
            loading={'eager'}
            alt=""
          />
        </AnimatePresence>
      ) : null}
    </div>
  );
};

export default MeetupDisplayPage;
