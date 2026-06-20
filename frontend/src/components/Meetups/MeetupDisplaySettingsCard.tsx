import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Input } from '@/components/ui/input';
import { useBoolean } from '@/hooks/useBoolean';
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

const gridClass =
  'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]';

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
      <h3 className="mb-1 text-xl font-medium">Idle Images</h3>
      {urls != null ? (
        <div className={gridClass}>
          {urls.map((imageUrl, index) => (
            <div key={index}>
              <AspectRatio ratio={16 / 9}>
                <div className="relative size-full border">
                  <ImageWithFallback
                    src={imageUrl}
                    className="size-full object-cover"
                  />
                  {isEditable ? (
                    <div className="absolute inset-0 flex items-center justify-between bg-black/50 p-4 opacity-0 transition-opacity duration-300 hover:opacity-100">
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label="Move left"
                        id={String(index)}
                        onClick={onMoveLeft}
                        disabled={index === 0}
                      >
                        <FiArrowLeft />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Delete"
                        id={String(index)}
                        onClick={onDelete}
                      >
                        <FiTrash2 />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label="Move right"
                        id={String(index)}
                        onClick={onMoveRight}
                        disabled={index === urls.length - 1}
                      >
                        <FiArrowRight />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </AspectRatio>
              {isEditable ? (
                <Input
                  id={String(index)}
                  className="mt-4"
                  value={urls[index]}
                  onChange={onChange}
                />
              ) : null}
            </div>
          ))}
          {isEditable ? (
            <div className="p-4">
              <AspectRatio ratio={16 / 9}>
                <Button
                  variant="outline"
                  aria-label="add"
                  className="size-full"
                  onClick={onAdd}
                >
                  <FiPlus className="size-8" />
                </Button>
              </AspectRatio>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* TODO(jan): Find cleaner way to do this. This is just copy and pasted because low on time */}

      <h3 className="mt-4 mb-1 text-xl font-medium">
        Raffle Winner Background
      </h3>
      <div className={gridClass}>
        <div>
          <AspectRatio ratio={16 / 9}>
            <div className="size-full border">
              <ImageWithFallback
                src={raffleBackgroundUrl}
                className="size-full object-cover"
              />
            </div>
          </AspectRatio>
          {isEditable ? (
            <Input
              className="mt-4"
              value={raffleBackgroundUrl}
              onChange={onRaffleBackgroundChange}
            />
          ) : null}
        </div>
      </div>

      <h3 className="mt-4 mb-1 text-xl font-medium">
        Raffle Winner Background (Batch)
      </h3>
      <div className={gridClass}>
        <div>
          <AspectRatio ratio={16 / 9}>
            <div className="size-full border">
              <ImageWithFallback
                src={batchRaffleBackgroundUrl}
                className="size-full object-cover"
              />
            </div>
          </AspectRatio>
          {isEditable ? (
            <Input
              className="mt-4"
              value={batchRaffleBackgroundUrl}
              onChange={onBatchRaffleBackgroundChange}
            />
          ) : null}
        </div>
      </div>
    </EditableFormCard>
  );
};

export default MeetupDisplaySettingsCard;
