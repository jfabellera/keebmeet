import {
  AspectRatio,
  Box,
  Grid,
  GridItem,
  Heading,
  IconButton,
  Image,
  Input,
  useBoolean,
} from '@chakra-ui/react';
import type React from 'react';
import { useEffect, useState, type ReactNode } from 'react';
import { FiArrowLeft, FiArrowRight, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  useEditMeetupMutation,
  useGetMeetupDisplayAssetsQuery,
} from '../../store/meetupSlice';
import EditableFormCard from '../Forms/EditableFormCard';

interface Props {
  meetupId: number;
}

const MeetupDisplaySettingsCard = ({ meetupId }: Props): ReactNode => {
  const { data: displayAssets } = useGetMeetupDisplayAssetsQuery(meetupId);
  const [updateMeetup] = useEditMeetupMutation();
  const [isEditable, setIsEditable] = useBoolean(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [raffleBackgroundUrl, setRaffleBackgroundUrl] = useState<string>('');
  const [batchRaffleBackgroundUrl, setBatchRaffleBackgroundUrl] =
    useState<string>('');

  useEffect(() => {
    setUrls(displayAssets?.idleImageUrls ?? []);
    setRaffleBackgroundUrl(displayAssets?.raffleWinnerBackgroundImageUrl ?? '');
    setBatchRaffleBackgroundUrl(
      displayAssets?.batchRaffleWinnerBackgroundImageUrl ?? ''
    );
  }, [displayAssets]);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setUrls((urls) => {
      const temp = [...urls];
      temp[Number(event.target.id)] = event.target.value;
      return temp;
    });
  };

  const onRaffleBackgroundChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setRaffleBackgroundUrl(event.target.value);
  };

  const onBatchRaffleBackgroundChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setBatchRaffleBackgroundUrl(event.target.value);
  };

  const onAdd = (): void => {
    setUrls((urls) => {
      return [...urls, ''];
    });
  };

  const onDelete = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const index = Number(event.currentTarget.id);
    setUrls((urls) => {
      const temp = [...urls];
      temp.splice(index, 1);
      return temp;
    });
  };

  const onMoveLeft = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const index = Number(event.currentTarget.id);
    if (index === 0) return;
    setUrls((urls) => {
      const temp = [...urls];
      temp.splice(index - 1, 1, temp.splice(index, 1, temp[index - 1])[0]);
      return temp;
    });
  };

  const onMoveRight = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const index = Number(event.currentTarget.id);
    if (index === urls.length - 1) return;
    setUrls((urls) => {
      const temp = [...urls];
      temp.splice(index, 1, temp.splice(index + 1, 1, temp[index])[0]);
      return temp;
    });
  };

  const onSubmit = (): void => {
    void (async () => {
      await updateMeetup({
        meetupId,
        payload: {
          display_idle_image_urls: urls,
          display_raffle_background_url: raffleBackgroundUrl,
          display_batch_raffle_background_url: batchRaffleBackgroundUrl,
        },
      });
    })();

    setIsEditable.off();
  };

  const onCancel = (): void => {
    if (displayAssets?.idleImageUrls != null)
      setUrls(displayAssets.idleImageUrls);

    setIsEditable.off();
  };

  return (
    <EditableFormCard
      title={'Display Settings'}
      isEditable={isEditable}
      onEditEnter={setIsEditable.on}
      onEditCancel={onCancel}
      onEditSubmit={onSubmit}
      isFormInvalid={false}
    >
      <Heading size={'md'} fontWeight={'medium'} marginBottom={'0.2rem'}>
        Idle Images
      </Heading>
      {urls != null ? (
        <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
          {urls.map((imageUrl, index) => (
            <GridItem key={index}>
              <AspectRatio ratio={16 / 9}>
                <Box border={'1px'}>
                  <Image src={imageUrl} />
                  {isEditable ? (
                    <Box
                      display={'flex'}
                      justifyContent={'space-between'}
                      alignItems={'center'}
                      position="absolute"
                      height={'100%'}
                      width={'100%'}
                      padding={'1rem'}
                      bg="rgba(0, 0, 0, 0.5)"
                      opacity={0}
                      transition="opacity 0.3s"
                      _hover={{ opacity: 1 }}
                    >
                      <IconButton
                        icon={<FiArrowLeft />}
                        aria-label={'Move left'}
                        colorScheme={'whiteAlpha'}
                        id={String(index)}
                        onClick={onMoveLeft}
                        isDisabled={index === 0}
                      />
                      <IconButton
                        icon={<FiTrash2 />}
                        aria-label={'Delete'}
                        colorScheme={'red'}
                        id={String(index)}
                        onClick={onDelete}
                      />
                      <IconButton
                        icon={<FiArrowRight />}
                        aria-label={'Move right'}
                        colorScheme={'whiteAlpha'}
                        id={String(index)}
                        onClick={onMoveRight}
                        isDisabled={index === urls.length - 1}
                      />
                    </Box>
                  ) : null}
                </Box>
              </AspectRatio>
              {isEditable ? (
                <Input
                  id={String(index)}
                  marginTop={'1rem'}
                  value={urls[index]}
                  onChange={onChange}
                />
              ) : null}
            </GridItem>
          ))}
          {isEditable ? (
            <GridItem padding={'1rem'}>
              <AspectRatio ratio={16 / 9}>
                <IconButton
                  fontSize={'2rem'}
                  icon={<FiPlus />}
                  aria-label={'add'}
                  onClick={onAdd}
                />
              </AspectRatio>
            </GridItem>
          ) : null}
        </Grid>
      ) : null}

      {/* TODO(jan): Find cleaner way to do this. This is just copy and pasted because low on time */}

      <Heading
        size={'md'}
        fontWeight={'medium'}
        marginTop={'1rem'}
        marginBottom={'0.2rem'}
      >
        Raffle Winner Background
      </Heading>
      <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
        <GridItem>
          <AspectRatio ratio={16 / 9}>
            <Box border={'1px'}>
              <Image src={raffleBackgroundUrl} />
            </Box>
          </AspectRatio>
          {isEditable ? (
            <Input
              marginTop={'1rem'}
              value={raffleBackgroundUrl}
              onChange={onRaffleBackgroundChange}
            />
          ) : null}
        </GridItem>
      </Grid>

      <Heading
        size={'md'}
        fontWeight={'medium'}
        marginTop={'1rem'}
        marginBottom={'0.2rem'}
      >
        Raffle Winner Background (Batch)
      </Heading>
      <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
        <GridItem>
          <AspectRatio ratio={16 / 9}>
            <Box border={'1px'}>
              <Image src={batchRaffleBackgroundUrl} />
            </Box>
          </AspectRatio>
          {isEditable ? (
            <Input
              marginTop={'1rem'}
              value={batchRaffleBackgroundUrl}
              onChange={onBatchRaffleBackgroundChange}
            />
          ) : null}
        </GridItem>
      </Grid>
    </EditableFormCard>
  );
};

export default MeetupDisplaySettingsCard;
