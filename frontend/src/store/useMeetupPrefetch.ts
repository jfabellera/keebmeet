import { type MeetupInfo } from '@keebmeet/shared';
import { useCallback } from 'react';
import { preloadImage, resizedImageUrl } from '../util/imageUrl';
import { useAppDispatch } from './hooks';
import { meetupSlice } from './meetupSlice';
import { gallerySlice } from './gallerySlice';

const MODAL_HERO_WIDTH = 768;
const PHOTO_THUMBNAIL_WIDTH = 256;

export const useMeetupHoverPrefetch = (): ((meetup: MeetupInfo) => void) => {
  const dispatch = useAppDispatch();
  const prefetchMeetup = meetupSlice.usePrefetch('getMeetup');
  const prefetchGalleries = gallerySlice.usePrefetch('getMeetupGallery');

  return useCallback(
    (meetup: MeetupInfo) => {
      // Meetup details
      prefetchMeetup(meetup.id);

      // Hero banner
      if (meetup.image_url !== '') {
        preloadImage(
          resizedImageUrl(meetup.image_url, { width: MODAL_HERO_WIDTH })
        );
      }

      // Only meetups with photos render the Photos section.
      if (meetup.has_photos !== true) return;

      prefetchGalleries(meetup.id);

      const previews = dispatch(
        gallerySlice.endpoints.getMeetupGalleryPreviews.initiate(meetup.id)
      );
      previews
        .unwrap()
        .then((results) => {
          results.forEach((preview) => {
            if (preview.image != null && preview.image !== '') {
              preloadImage(
                resizedImageUrl(preview.image, { width: PHOTO_THUMBNAIL_WIDTH })
              );
            }
          });
        })
        .catch(() => {})
        .finally(() => {
          previews.unsubscribe();
        });
    },
    [dispatch, prefetchMeetup, prefetchGalleries]
  );
};
