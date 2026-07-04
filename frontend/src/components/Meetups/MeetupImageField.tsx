import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Input } from '@/components/ui/input';
import { type ChangeEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useUploadMeetupImageMutation } from '../../store/meetupSlice';

interface Props {
  /** URL used to render the current image preview. */
  previewUrl: string;
  /** Called with the R2 object key (and its public URL) after a successful upload. */
  onUploaded: (imageKey: string, imageUrl: string) => void;
  onRemove?: () => void;
  /** When false, only the preview is shown (no file picker). Defaults to true. */
  editable?: boolean;
  label?: string;
}

/**
 * Meetup image picker: shows a preview and, when editable, a file input that
 * uploads the chosen image to R2 via the backend and reports back the stored
 * object key.
 */
const MeetupImageField = ({
  previewUrl,
  onUploaded,
  onRemove,
  editable = true,
  label = 'Meetup Image',
}: Props): ReactNode => {
  const [uploadImage, { isLoading }] = useUploadMeetupImageMutation();

  const onFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file == null) return;

    void (async () => {
      const result = await uploadImage(file);
      if ('error' in result && result.error != null) {
        const data: any = 'data' in result.error ? result.error.data : null;
        toast.error('Error uploading image', {
          description: data?.message ?? 'Please try a different image.',
        });
        return;
      }
      onUploaded(result.data.image_key, result.data.image_url);
    })();
  };

  return (
    <Field className="max-w-sm min-w-0 py-2">
      <FieldLabel htmlFor="meetupImage" className="line-clamp-1">
        {label}
      </FieldLabel>
      <AspectRatio ratio={2 / 1}>
        <div className="size-full border">
          <ImageWithFallback
            src={previewUrl}
            className="size-full object-cover"
          />
        </div>
      </AspectRatio>
      {editable ? (
        <div className="mt-4 flex items-center gap-2">
          <Input
            id="meetupImage"
            name="meetupImage"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isLoading}
            onChange={onFileChange}
          />
          {onRemove != null && previewUrl !== '' ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onRemove}
              disabled={isLoading}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </Field>
  );
};

export default MeetupImageField;
