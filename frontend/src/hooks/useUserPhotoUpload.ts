import { useUploadUserImageMutation } from '../store/userSlice';
import { useImageUpload } from './useImageUpload';

/** Profile-photo upload flow (POSTs to /users/photo; works pre-auth). */
export const useUserPhotoUpload = (): ReturnType<typeof useImageUpload> =>
  useImageUpload(useUploadUserImageMutation);
