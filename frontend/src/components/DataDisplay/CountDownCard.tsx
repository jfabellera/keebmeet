import {
  Box,
  Heading,
  HStack,
  Text,
  VStack,
  type BoxProps,
} from '@chakra-ui/react';
import dayjs, { type Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
dayjs.extend(duration);

const convertToSmallestUnitOfTime = (
  durationMs: number
): { amount: number; unit: string } => {
  const duration = dayjs.duration(Math.abs(durationMs));
  const days = Math.floor(duration.asDays());
  const hours = Math.floor(duration.asHours());
  const minutes = Math.floor(duration.asMinutes());
  const seconds = Math.floor(duration.asSeconds());

  if (days > 0) return { amount: days, unit: `day${days > 1 ? 's' : ''}` };
  if (hours > 0) return { amount: hours, unit: `hour${hours > 1 ? 's' : ''}` };
  if (minutes > 0)
    return { amount: minutes, unit: `minute${minutes > 1 ? 's' : ''}` };
  return { amount: seconds, unit: `second${seconds > 1 ? 's' : ''}` };
};

interface CountDownProps extends BoxProps {
  date: Date | Dayjs;
  futureText: string;
  pastText: string;
  simple?: boolean;
}

const CountDown = ({
  date,
  futureText,
  pastText,
  simple,
  ...rest
}: CountDownProps): ReactNode => {
  const [durationMs, setDurationMs] = useState<number>(dayjs(date).diff());

  const { amount, unit } = useMemo(
    () => convertToSmallestUnitOfTime(durationMs),
    [durationMs]
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setDurationMs(dayjs(date).diff());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <Box
      background={'white'}
      borderRadius={'md'}
      boxShadow={'sm'}
      padding={'1rem'}
      {...rest}
    >
      <VStack spacing={0}>
        <HStack align={'baseline'}>
          {simple != null && simple ? (
            <>
              <Heading size={'2xl'} fontWeight={'medium'}>
                {amount}
              </Heading>
              <Heading size={'sm'} fontWeight={'normal'}>
                {unit.toUpperCase()}
              </Heading>
            </>
          ) : (
            <Heading size={'2xl'} fontWeight={'medium'}>
              {dayjs.duration(Math.abs(durationMs)).format('HH:mm:ss')}
            </Heading>
          )}
        </HStack>
        <Text fontSize={'xs'} textAlign={'center'}>
          {durationMs > 0 ? futureText.toUpperCase() : pastText.toUpperCase()}
        </Text>
      </VStack>
    </Box>
  );
};

export default CountDown;
