import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useId, type ChangeEvent, type ReactNode } from 'react';
import { IMAGE_ACCEPT, useImageUpload } from '../../hooks/useImageUpload';

interface Props {
  /** URL used to render the current image preview ('' shows a placeholder). */
  previewUrl: string;
  /** Called with the R2 object key (and its public URL) after a successful upload. */
  onUploaded: (imageKey: string, imageUrl: string) => void;
  /**
   * Called when the user clears the current image. When provided, a "Remove"
   * button is shown while editing and an image is present.
   */
  onRemove?: () => void;
  /** When false, only the preview is shown (no file picker). Defaults to true. */
  editable?: boolean;
  label?: string;
  /** Preview aspect ratio (width/height). Defaults to 2 (meetup banner). */
  aspectRatio?: number;
  /** Render the preview as a circle (for avatars). */
  rounded?: boolean;
  /** Extra classes for the outer field (e.g. to constrain width). */
  className?: string;
  /** The upload hook to use (meetup vs user photo endpoint). */
  useUpload: () => ReturnType<typeof useImageUpload>;
}

/**
 * Reusable image picker: shows a preview and, when editable, a file input that
 * uploads the chosen image via the given hook and reports back the stored key,
 * plus an optional Remove button. Shared by meetup images and user photos.
 */
const ImageUploadField = ({
  previewUrl,
  onUploaded,
  onRemove,
  editable = true,
  label = 'Image',
  aspectRatio = 2,
  rounded = false,
  className,
  useUpload,
}: Props): ReactNode => {
  const { upload, isUploading } = useUpload();
  const inputId = useId();

  const onFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file != null) upload(file, onUploaded);
  };

  return (
    <Field className={cn('max-w-sm min-w-0 py-2', className)}>
      <FieldLabel htmlFor={inputId} className="line-clamp-1">
        {label}
      </FieldLabel>
      <AspectRatio ratio={aspectRatio}>
        <div
          className={cn(
            'size-full border',
            rounded && 'overflow-hidden rounded-full'
          )}
        >
          <ImageWithFallback
            src={previewUrl}
            className="size-full object-cover"
          />
        </div>
      </AspectRatio>
      {editable ? (
        <div className="mt-4 flex items-center gap-2">
          <Input
            id={inputId}
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={isUploading}
            onChange={onFileChange}
          />
          {onRemove != null && previewUrl !== '' ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onRemove}
              disabled={isUploading}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </Field>
  );
};

export default ImageUploadField;
