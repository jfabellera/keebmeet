import { useImageUpload } from '../../hooks/useImageUpload';
import { useUploadMeetupImageMutation } from '../../store/meetupSlice';

export { IMAGE_ACCEPT } from '../../hooks/useImageUpload';

/** Meetup-image upload flow (POSTs to /meetups/image). */
export const useMeetupImageUpload = (): ReturnType<typeof useImageUpload> =>
  useImageUpload(useUploadMeetupImageMutation);
