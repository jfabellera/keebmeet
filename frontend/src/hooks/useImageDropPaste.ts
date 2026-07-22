import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from 'react';
import { IMAGE_ACCEPT } from './useImageUpload';

const acceptedTypes = new Set(IMAGE_ACCEPT.split(','));

/** First accepted image in a drop/paste transfer, or null. */
const firstImage = (files: FileList | null | undefined): File | null => {
  if (files == null) return null;
  return Array.from(files).find((file) => acceptedTypes.has(file.type)) ?? null;
};

/**
 * Adds drag-and-drop and paste-to-upload to an image field. Attach `ref` to the
 * drop target and spread `dropzoneProps` onto it, then render a "drop here"
 * affordance while `isDragging`. The first accepted image is handed to `onFile`.
 *
 * Paste is only claimed when the target is hovered or holds focus, so multiple
 * fields on a page don't fight over a pasted image. Set `captureGlobalPaste`
 * (e.g. inside a dialog with a single image target) to accept a pasted image
 * regardless of hover — text pastes are never intercepted, only image files.
 */
export const useImageDropPaste = ({
  onFile,
  disabled = false,
  captureGlobalPaste = false,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  captureGlobalPaste?: boolean;
}): {
  ref: RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  dropzoneProps: {
    onDragEnter: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
} => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Depth counter so dragging over child elements doesn't flip the state off.
  const dragDepth = useRef(0);

  // Keep the latest callback so the paste listener needn't resubscribe.
  const onFileRef = useRef(onFile);
  useEffect(() => {
    onFileRef.current = onFile;
  });

  useEffect(() => {
    if (disabled) return;
    const onPaste = (event: ClipboardEvent): void => {
      const element = ref.current;
      if (element == null) return;
      if (!captureGlobalPaste) {
        const active = document.activeElement;
        const isFocused = active != null && element.contains(active);
        if (!isFocused && !element.matches(':hover')) return;
      }
      const image = firstImage(event.clipboardData?.files);
      if (image != null) {
        event.preventDefault();
        onFileRef.current(image);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [disabled, captureGlobalPaste]);

  const reset = (): void => {
    dragDepth.current = 0;
    setIsDragging(false);
  };

  return {
    ref,
    isDragging,
    dropzoneProps: {
      onDragEnter: (event) => {
        if (disabled) return;
        event.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      },
      onDragOver: (event) => {
        if (disabled) return;
        // Required for onDrop to fire.
        event.preventDefault();
      },
      onDragLeave: (event) => {
        if (disabled) return;
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) reset();
      },
      onDrop: (event) => {
        if (disabled) return;
        event.preventDefault();
        reset();
        const image = firstImage(event.dataTransfer?.files);
        if (image != null) onFileRef.current(image);
      },
    },
  };
};
