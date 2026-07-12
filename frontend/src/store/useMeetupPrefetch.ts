import { type MeetupInfo } from '@keebmeet/shared';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { preloadImage, resizedImageUrl } from '../util/imageUrl';
import { useAppDispatch } from './hooks';
import { meetupSlice } from './meetupSlice';
import { gallerySlice } from './gallerySlice';

const MODAL_HERO_WIDTH = 768;
const PHOTO_THUMBNAIL_WIDTH = 256;

export const useMeetupPrefetch = (): ((meetup: MeetupInfo) => void) => {
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

/**
 * Prefetch a meetup once the element the returned ref is attached to scrolls
 * into view, but only on devices that can't hover (touch). Seeing a card is
 * the closest mobile analog to hovering over it. Hover-capable devices skip
 * this and keep the more targeted mouseenter prefetch, so they don't fetch
 * every card that happens to be on screen.
 */
export const useMeetupInViewPrefetch = (
  meetup: MeetupInfo
): RefObject<HTMLDivElement | null> => {
  const prefetchMeetup = useMeetupPrefetch();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element == null) return;
    if (window.matchMedia('(hover: hover)').matches) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting !== true) return;
      prefetchMeetup(meetup);
      // Prefetching is one-shot, so stop watching after the first sighting.
      observer.disconnect();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [meetup, prefetchMeetup]);

  return ref;
};
