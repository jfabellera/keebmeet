import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
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
  /** Field label. Omit to render no label (e.g. inside a grid with its own heading). */
  label?: string;
  /**
   * Controls rendered in a row directly below the preview, e.g. reorder/remove
   * buttons for a gallery item. Only shown while editable.
   */
  footer?: ReactNode;
  /** Preview aspect ratio (width/height). Defaults to 2 (meetup banner). */
  aspectRatio?: number;
  /** Render the preview as a circle (for avatars). */
  rounded?: boolean;
  /** Extra classes for the outer field (e.g. to constrain width). */
  className?: string;
  /** The upload hook to use (meetup vs user photo endpoint). */
  useUpload: () => ReturnType<typeof useImageUpload>;
  previewWidth?: number;
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
  label,
  footer,
  aspectRatio = 2,
  rounded = false,
  className,
  useUpload,
  previewWidth,
}: Props): ReactNode => {
  const { upload, isUploading } = useUpload();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(hover: none)');
    const update = (): void => setIsTouch(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [revealed, setRevealed] = useState(false);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file != null) upload(file, onUploaded);
    // Allow re-selecting the same file after a remove/re-add.
    event.target.value = '';
  };

  return (
    <Field className={cn('max-w-sm min-w-0 py-2', className)}>
      {label != null && label !== '' ? (
        <FieldLabel
          htmlFor={inputId}
          className={cn('line-clamp-1', rounded && 'w-full text-center')}
        >
          {label}
        </FieldLabel>
      ) : null}
      <AspectRatio ratio={aspectRatio}>
        <div
          className={cn(
            'group relative size-full border',
            rounded && 'overflow-hidden rounded-full',
            editable && isTouch && 'cursor-pointer'
          )}
          onClick={
            editable && isTouch ? () => setRevealed((prev) => !prev) : undefined
          }
        >
          <ImageWithFallback
            src={previewUrl}
            resizeWidth={previewWidth}
            className="size-full object-cover"
          />
          {editable ? (
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity',
                'pointer-events-none',
                'group-hover:pointer-events-auto group-hover:opacity-100',
                'focus-within:pointer-events-auto focus-within:opacity-100',
                rounded && 'rounded-full',
                revealed && 'pointer-events-auto opacity-100'
              )}
            >
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept={IMAGE_ACCEPT}
                disabled={isUploading}
                onChange={onFileChange}
                className="sr-only"
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
                disabled={isUploading}
                aria-label="Change image"
              >
                {isUploading ? <Spinner /> : <Pencil />}
              </Button>
              {onRemove != null && previewUrl !== '' ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove();
                  }}
                  disabled={isUploading}
                  aria-label="Remove image"
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </AspectRatio>
      {editable && footer != null ? (
        <div className="mt-2 flex items-center justify-center gap-1">
          {footer}
        </div>
      ) : null}
    </Field>
  );
};

export default ImageUploadField;
