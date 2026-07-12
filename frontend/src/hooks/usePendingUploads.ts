import { useCallback, useState } from 'react';

/**
 * Tracks whether any image upload is still in flight so forms can block
 * submission until it settles. Pass `onUploadingChange` to each
 * ImageUploadField and gate the submit button on `isUploading`. Counts
 * starts/finishes so multiple fields can upload concurrently.
 */
export const usePendingUploads = (): {
  isUploading: boolean;
  onUploadingChange: (isUploading: boolean) => void;
} => {
  const [pendingCount, setPendingCount] = useState(0);

  const onUploadingChange = useCallback((isUploading: boolean) => {
    setPendingCount((count) => count + (isUploading ? 1 : -1));
  }, []);

  return { isUploading: pendingCount > 0, onUploadingChange };
};
