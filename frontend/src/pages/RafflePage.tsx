import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  Input,
  Switch,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useFormik } from 'formik';
import { useEffect, useState, type ReactNode } from 'react';
import { FiSettings } from 'react-icons/fi';
import { MdHistory } from 'react-icons/md';
import { useParams } from 'react-router-dom';
import { type RaffleRecordResponse } from '../../../backend/src/interfaces/rafflesInterfaces';
import RaffleHistoryList from '../components/RafflePage/RaffleHistoryList';
import { socket } from '../socket';
import {
  useClaimRaffleWinnerMutation,
  useGetRaffleRecordQuery,
  useMarkRaffleAsDisplayedMutation,
  useRollRaffleWinnerMutation,
  useUnClaimRaffleWinnerMutation,
} from '../store/organizerSlice';

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

  const toast = useToast({ position: 'top-right', duration: 2500 });
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
    },
    onSubmit: () => {},
  });

  const handleRoll = (): void => {
    void (async () => {
      await rollRaffleWinner({
        meetupId,
        payload: { quantity: formik.values.rollQuantity },
      });
    })();
    setIsAllIn(false);
  };

  const handleRollAllIn = (): void => {
    void (async () => {
      await rollRaffleWinner({ meetupId, payload: { allIn: true } });
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
        toast({
          title: 'Roll failed',
          status: 'warning',
          description: 'No eligible attendees',
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
      toast({
        title: 'Success',
        status: 'success',
        description: `Raffle claimed`, // TODO(jan): Include claimer's name
      });

      if (formik.values.clearOnClaim) {
        handleClear();
      }

      setIsAllIn(false);
      setIsRollable(true);
    }
  }, [isClaimSuccess]);

  useEffect(() => {
    if (isUnClaimSuccess) {
      toast({
        title: 'Success',
        status: 'success',
        description: 'Raffle unclaimed',
      });
    }
  }, [isUnClaimSuccess]);

  useEffect(() => {
    if (isRollError || isClaimError || isUnClaimError) {
      toast({
        title: 'Error',
        status: 'error',
        description: 'Action failed',
      });
    }
  }, [isRollError, isClaimError, isUnClaimError]);

  return (
    <Flex justify={'center'} height={'100%'}>
      <VStack
        spacing={4}
        height={'100%'}
        padding={'1rem'}
        width={'100%'}
        maxWidth={'800px'}
      >
        <Box
          textAlign={'center'}
          flexGrow={1}
          width={'100%'}
          overflow={'scroll'}
        >
          {raffleRecordId != null &&
          raffleRecord != null &&
          raffleRecordId === Number(raffleRecord.id) && // TODO(jan): id is a string
          raffleRecord.winners.length > 0 ? (
            raffleRecord.winners.length > 1 ? (
              <Box height={0}>
                {/* Display for batch roll */}
                <Text>WINNERS</Text>
                <VStack>
                  {raffleRecord.winners.map((winner, index) => {
                    return (
                      <Flex
                        key={index}
                        width={'100%'}
                        textAlign={'left'}
                        flexDirection={'row'}
                        justifyContent={'space-between'}
                      >
                        <Text
                          fontSize={'2xl'}
                          noOfLines={1}
                          minWidth={0}
                          wordBreak={'break-all'}
                        >
                          {`${index + 1}. ${winner.displayName}`}
                        </Text>
                        <Button
                          colorScheme={
                            raffleRecord.winners != null && isDisplayed
                              ? 'green'
                              : 'blackAlpha'
                          }
                          id={String(index)}
                          onClick={
                            !winner.claimed ? handleClaim : handleUnclaim
                          }
                          isLoading={isClaimLoading || isUnClaimLoading}
                        >
                          {!winner.claimed ? 'Claim' : 'Unclaim'}
                        </Button>
                      </Flex>
                    );
                  })}
                </VStack>
              </Box>
            ) : (
              <Box height={0}>
                {/* DIsplay for single person roll */}
                <Text>WINNER</Text>
                <Text
                  fontSize={'3rem'}
                  fontWeight={'medium'}
                  wordBreak={'break-all'}
                >
                  {raffleRecord.winners[0].displayName ?? ''}
                </Text>
                <Text marginTop={'0.3rem'}>
                  {raffleRecord.winners[0].firstName}{' '}
                  {raffleRecord.winners[0].lastName}
                </Text>
                {raffleRecord.winners[0].wins > 0 ? (
                  <Text textColor={'red'}>
                    {raffleRecord.winners[0].wins} win
                    {raffleRecord.winners[0].wins > 1 ? 's' : null}
                  </Text>
                ) : null}
              </Box>
            )
          ) : (
            <Text lineHeight={'6rem'}>Click roll to select a winner</Text>
          )}
        </Box>
        <Flex width={'100%'} justifyContent={'space-evenly'} align={'center'}>
          <Button
            variant={'ghost'}
            leftIcon={<MdHistory />}
            onClick={onHistoryOpen}
          >
            Raffle history
          </Button>
          <Button variant={'ghost'} leftIcon={<FiSettings />} onClick={onOpen}>
            More options
          </Button>
        </Flex>
        <Grid
          width={'100%'}
          templateRows={
            raffleRecord != null && raffleRecord.winners.length > 1
              ? 'repeat(2, 100px)'
              : 'repeat(3, 100px)'
          }
          templateColumns="repeat(2, 1fr)"
          gap={2}
        >
          <GridItem rowSpan={1} colSpan={2}>
            <Button
              width={'100%'}
              height={'100%'}
              colorScheme={isRollable ? 'green' : 'blackAlpha'}
              onClick={handleRoll}
              isLoading={isRollLoading}
              isDisabled={!isRollable}
              flexDir={'column'}
            >
              <Heading fontWeight={'medium'}>
                Roll{' '}
                {formik.values.rollQuantity > 1
                  ? formik.values.rollQuantity
                  : null}
              </Heading>
              {formik.values.displayOnRoll ? (
                <Text fontSize={'14px'}>and display</Text>
              ) : null}
            </Button>
          </GridItem>
          <GridItem
            rowSpan={1}
            colSpan={
              raffleRecord != null && raffleRecord.winners.length > 1 ? 1 : 2
            }
          >
            <Button
              width={'100%'}
              height={'100%'}
              colorScheme={
                raffleRecordId != null && !isDisplayed && !isRollable
                  ? 'green'
                  : 'blackAlpha'
              }
              onClick={handleDisplay}
              isDisabled={raffleRecordId == null}
            >
              <Heading fontWeight={'medium'}>Display</Heading>
            </Button>
          </GridItem>
          {raffleRecord == null || raffleRecord.winners.length === 1 ? (
            <GridItem colSpan={1}>
              <Button
                width={'100%'}
                height={'100%'}
                colorScheme={
                  raffleRecordId != null && isDisplayed ? 'green' : 'blackAlpha'
                }
                id={'0'}
                onClick={
                  !(raffleRecord?.winners[0].claimed ?? false)
                    ? handleClaim
                    : handleUnclaim
                }
                isLoading={isClaimLoading || isUnClaimLoading}
                isDisabled={raffleRecordId == null}
              >
                <Heading fontWeight={'medium'}>
                  {!(raffleRecord?.winners[0].claimed ?? false)
                    ? 'Claim'
                    : 'Unclaim'}
                </Heading>
              </Button>
            </GridItem>
          ) : null}
          <GridItem colSpan={1}>
            <Button
              width={'100%'}
              height={'100%'}
              colorScheme={
                !isRollable && isDisplayed
                  ? 'red'
                  : isDisplayed
                    ? 'yellow'
                    : 'blackAlpha'
              }
              onClick={handleClear}
            >
              <Heading fontWeight={'medium'}>Clear</Heading>
            </Button>{' '}
          </GridItem>
        </Grid>
      </VStack>

      <Drawer isOpen={isOpen} placement={'bottom'} onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>Options</DrawerHeader>

          <DrawerBody>
            <VStack spacing={6}>
              {/* TODO(jan): Implement logic */}
              <FormControl id={'rollQuantity'}>
                <FormLabel>Roll quantity</FormLabel>
                <Input
                  type={'number'}
                  inputMode={'numeric'}
                  value={formik.values.rollQuantity}
                  onChange={formik.handleChange}
                />
              </FormControl>

              <FormControl
                id={'displayOnRoll'}
                display={'flex'}
                alignItems={'center'}
              >
                <FormLabel mb={0}>Display on roll</FormLabel>
                <Switch
                  isChecked={formik.values.displayOnRoll}
                  onChange={formik.handleChange}
                />
              </FormControl>

              <FormControl
                id={'clearOnClaim'}
                display={'flex'}
                alignItems={'center'}
              >
                <FormLabel mb={0}>Clear on claim</FormLabel>
                <Switch
                  isChecked={formik.values.clearOnClaim}
                  onChange={formik.handleChange}
                />
              </FormControl>

              <Box width={'100%'}>
                <Button
                  width={'100%'}
                  height={'3rem'}
                  colorScheme={'red'}
                  onClick={handleRollAllIn}
                  isDisabled={raffleRecordId != null}
                >
                  Roll all in
                </Button>
                <Text textAlign={'center'} marginTop={'0.25rem'}>
                  Previous winners are eligible to win
                </Text>
              </Box>
            </VStack>
          </DrawerBody>

          <DrawerFooter></DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        isOpen={isHistoryOpen}
        placement={'right'}
        onClose={onHistoryClose}
      >
        <DrawerOverlay />
        <DrawerContent background={'gray.100'}>
          <DrawerCloseButton />
          <DrawerHeader>Raffle history</DrawerHeader>

          <DrawerBody>
            <RaffleHistoryList
              meetupId={Number(meetupId)}
              onCardClick={handleRaffleRecordSelect}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
};

export default RafflePage;
