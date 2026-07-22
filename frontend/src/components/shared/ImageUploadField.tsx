import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { Pencil, Trash2, Upload } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { useImageDropPaste } from '../../hooks/useImageDropPaste';
import { IMAGE_ACCEPT, useImageUpload } from '../../hooks/useImageUpload';

interface Props {
  /** URL used to render the current image preview ('' shows a placeholder). */
  previewUrl: string;
  /** Called with the R2 object key (and its public URL) after a successful upload. */
  onUploaded: (imageKey: string, imageUrl: string) => void;
  /**
   * Called with true when an upload starts and false when it settles (or the
   * field unmounts mid-upload). Wire to usePendingUploads so the parent form
   * can block submission while an upload is in flight.
   */
  onUploadingChange?: (isUploading: boolean) => void;
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
  /** The RTK Query image-upload mutation hook for the target endpoint. */
  useUploadMutation: Parameters<typeof useImageUpload>[0];
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
  onUploadingChange,
  onRemove,
  editable = true,
  label,
  footer,
  aspectRatio = 2,
  rounded = false,
  className,
  useUploadMutation,
  previewWidth,
}: Props): ReactNode => {
  const { upload, isUploading } = useImageUpload(useUploadMutation);
  useEffect(() => {
    if (!isUploading) return;
    onUploadingChange?.(true);
    // The cleanup also reports settled if the field unmounts mid-upload.
    return () => onUploadingChange?.(false);
  }, [isUploading, onUploadingChange]);
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

  const {
    ref: dropRef,
    isDragging,
    dropzoneProps,
  } = useImageDropPaste({
    onFile: (file) => upload(file, onUploaded),
    disabled: !editable || isUploading,
  });

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
          ref={dropRef}
          className={cn(
            'group relative size-full border',
            rounded && 'overflow-hidden rounded-full',
            editable && (previewUrl === '' || isTouch) && 'cursor-pointer',
            isDragging && 'ring-ring ring-2'
          )}
          onClick={
            editable
              ? () => {
                  // Empty: the whole area is the picker (no edit overlay shown).
                  // Filled on touch: tap toggles the edit/remove overlay.
                  if (previewUrl === '') inputRef.current?.click();
                  else if (isTouch) setRevealed((prev) => !prev);
                }
              : undefined
          }
          {...(editable ? dropzoneProps : {})}
        >
          {!isUploading ? (
            <ImageWithFallback
              src={previewUrl}
              resizeWidth={previewWidth}
              className="size-full object-cover"
              fallback={
                editable ? (
                  <div className="bg-primary-foreground text-muted-foreground flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
                    {/* The drag overlay carries its own icon; hide this one
                        while dragging so they don't stack. */}
                    {!isDragging ? (
                      <>
                        <Upload className="size-6" />
                        {!rounded ? (
                          <span className="text-xs font-medium">
                            Drag, paste, or click
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : undefined
              }
            />
          ) : null}
          {editable ? (
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={IMAGE_ACCEPT}
              disabled={isUploading}
              onChange={onFileChange}
              className="sr-only"
            />
          ) : null}
          {editable && previewUrl !== '' ? (
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white opacity-0 transition-opacity',
                'pointer-events-none',
                'group-hover:pointer-events-auto group-hover:opacity-100',
                'focus-within:pointer-events-auto focus-within:opacity-100',
                rounded && 'rounded-full',
                revealed && 'pointer-events-auto opacity-100'
              )}
            >
              <div className="flex items-center justify-center gap-2">
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
                {onRemove != null ? (
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
              {!rounded ? (
                <span className="pointer-events-none px-2 text-center text-xs font-medium">
                  Drag or paste to replace
                </span>
              ) : null}
            </div>
          ) : null}
          {isUploading ? (
            <div
              className={cn(
                'bg-muted text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2',
                rounded && 'rounded-full'
              )}
            >
              <Spinner className="size-6" />
              {!rounded ? (
                <span className="text-sm font-medium">Uploading…</span>
              ) : null}
            </div>
          ) : null}
          {editable && isDragging ? (
            <div
              className={cn(
                'bg-primary/20 text-foreground pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1',
                rounded && 'rounded-full'
              )}
            >
              <Upload className="size-5" />
              {!rounded ? (
                <span className="text-sm font-medium">Drop image</span>
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
