import { toast } from 'sonner';

/** File types the image upload endpoints accept (mirrors the backend filter). */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

interface UploadResult {
  image_key: string;
  image_url: string;
}

type UploadMutationHook = () => readonly [
  (file: File) => Promise<{ data?: UploadResult; error?: unknown }>,
  { isLoading: boolean },
];

/**
 * Wraps an RTK Query image-upload mutation with shared success/error handling:
 * uploads the file and reports the stored key + public URL to `onSuccess`, or
 * shows a toast (with the backend's specific message) on failure. Reused by the
 * meetup image and user photo flows.
 */
export const useImageUpload = (
  useUploadMutation: UploadMutationHook
): {
  upload: (
    file: File,
    onSuccess: (imageKey: string, imageUrl: string) => void
  ) => void;
  isUploading: boolean;
} => {
  const [uploadImage, { isLoading }] = useUploadMutation();

  const upload = (
    file: File,
    onSuccess: (imageKey: string, imageUrl: string) => void
  ): void => {
    void (async () => {
      const result = await uploadImage(file);
      if (result.error != null) {
        const data = (result.error as { data?: { message?: string } }).data;
        toast.error('Error uploading image', {
          description: data?.message ?? 'Please try a different image.',
        });
        return;
      }
      if (result.data != null) {
        onSuccess(result.data.image_key, result.data.image_url);
      }
    })();
  };

  return { upload, isUploading: isLoading };
};
