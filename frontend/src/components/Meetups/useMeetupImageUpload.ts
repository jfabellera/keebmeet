import { toast } from 'sonner';
import { useUploadMeetupImageMutation } from '../../store/meetupSlice';

/** File types the image upload endpoint accepts (mirrors the backend filter). */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * Uploads a meetup image to R2 and reports the stored key + public URL to
 * `onSuccess`, showing a toast (with the backend's specific message) on failure.
 * Shared by the meetup-image field and the display-settings card.
 */
export const useMeetupImageUpload = (): {
  upload: (
    file: File,
    onSuccess: (imageKey: string, imageUrl: string) => void
  ) => void;
  isUploading: boolean;
} => {
  const [uploadImage, { isLoading }] = useUploadMeetupImageMutation();

  const upload = (
    file: File,
    onSuccess: (imageKey: string, imageUrl: string) => void
  ): void => {
    void (async () => {
      const result = await uploadImage(file);
      if ('error' in result && result.error != null) {
        const data: any = 'data' in result.error ? result.error.data : null;
        toast.error('Error uploading image', {
          description: data?.message ?? 'Please try a different image.',
        });
        return;
      }
      onSuccess(result.data.image_key, result.data.image_url);
    })();
  };

  return { upload, isUploading: isLoading };
};
