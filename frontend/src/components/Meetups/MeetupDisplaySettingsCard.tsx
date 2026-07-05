import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { useBoolean } from '@/hooks/useBoolean';
import { useEffect, useState, type ReactNode } from 'react';
import { FiArrowLeft, FiArrowRight, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  useEditMeetupMutation,
  useGetMeetupDisplayAssetsQuery,
} from '../../store/meetupSlice';
import EditableFormCard from '../Forms/EditableFormCard';
import ImageUploadField from '../shared/ImageUploadField';
import { useMeetupImageUpload } from './useMeetupImageUpload';

interface Props {
  meetupId: string;
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

  const setIdleUrl = (index: number, url: string): void => {
    setUrls((urls) => {
      const temp = [...urls];
      temp[index] = url;
      return temp;
    });
  };

  const onAdd = (): void => {
    setUrls((urls) => [...urls, '']);
  };

  // Removes an idle slot entirely, except the last remaining slot which is just
  // cleared — so there's always at least one field.
  const onRemove = (index: number): void => {
    setUrls((urls) => {
      if (urls.length <= 1) {
        const temp = urls.length > 0 ? [...urls] : [''];
        temp[index] = '';
        return temp;
      }
      const temp = [...urls];
      temp.splice(index, 1);
      return temp;
    });
  };

  const onMoveLeft = (index: number): void => {
    if (index === 0) return;
    setUrls((urls) => {
      const temp = [...urls];
      temp.splice(index - 1, 1, temp.splice(index, 1, temp[index - 1])[0]);
      return temp;
    });
  };

  const onMoveRight = (index: number): void => {
    setUrls((urls) => {
      if (index === urls.length - 1) return urls;
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
          display_idle_image_urls: urls.filter((url) => url !== ''),
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
      <h3 className="mb-1 text-lg font-medium">Idle Images</h3>
      <div className={gridClass}>
        {(urls.length > 0 ? urls : ['']).map((imageUrl, index, idleUrls) => (
          <ImageUploadField
            key={index}
            previewUrl={imageUrl}
            editable={isEditable}
            aspectRatio={16 / 9}
            className="max-w-none py-0"
            useUpload={useMeetupImageUpload}
            onUploaded={(_imageKey, imageUrl) => setIdleUrl(index, imageUrl)}
            footer={
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move left"
                  disabled={index === 0}
                  onClick={() => onMoveLeft(index)}
                >
                  <FiArrowLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove"
                  onClick={() => onRemove(index)}
                >
                  <FiTrash2 />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Move right"
                  disabled={index === idleUrls.length - 1}
                  onClick={() => onMoveRight(index)}
                >
                  <FiArrowRight />
                </Button>
              </>
            }
          />
        ))}
        {isEditable ? (
          <div>
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

      <div className="flex flex-wrap justify-around gap-4">
        <div className="flex-1">
          <h3 className="mt-4 mb-1 text-lg font-medium">
            Raffle Winner Background
          </h3>
          <div className={gridClass}>
            <ImageUploadField
              previewUrl={raffleBackgroundUrl}
              editable={isEditable}
              aspectRatio={16 / 9}
              className="max-w-none py-0"
              useUpload={useMeetupImageUpload}
              onUploaded={(_imageKey, imageUrl) =>
                setRaffleBackgroundUrl(imageUrl)
              }
              onRemove={() => setRaffleBackgroundUrl('')}
            />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="mt-4 mb-1 text-lg font-medium">
            Raffle Winner Background (Batch)
          </h3>
          <div className={gridClass}>
            <ImageUploadField
              previewUrl={batchRaffleBackgroundUrl}
              editable={isEditable}
              aspectRatio={16 / 9}
              className="max-w-none py-0"
              useUpload={useMeetupImageUpload}
              onUploaded={(_imageKey, imageUrl) =>
                setBatchRaffleBackgroundUrl(imageUrl)
              }
              onRemove={() => setBatchRaffleBackgroundUrl('')}
            />
          </div>
        </div>
      </div>
    </EditableFormCard>
  );
};

export default MeetupDisplaySettingsCard;
