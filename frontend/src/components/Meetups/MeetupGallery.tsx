import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  type GalleryInfo,
  type GalleryPreview,
  type MeetupInfo,
} from '@keebmeet/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useCreateGalleryMutation,
  useGetMeetupGalleryPreviewsQuery,
  useGetMeetupGalleryQuery,
} from '../../store/gallerySlice';
import { useAppSelector } from '../../store/hooks';
import { hasMeetupStarted } from '../../util/timeUtil';
import { GalleryActions, errorMessage } from './GalleryActions';
import { GalleryCard } from './GalleryCard';

interface MeetupGalleryProps {
  meetup: MeetupInfo;
  /** Whether the viewer holds a ticket for this meetup. */
  isAttendee: boolean;
}

/**
 * Photos section for a meetup: contributors' galleries rendered as tiles.
 * Shown when the meetup already has links, or when a started meetup is being
 * viewed by an attendee (who can then add their own). For archived meetups the
 * organizer instead curates the gallery — many links, each credited to a typed
 * contributor name (attendees/tickets don't exist for archives).
 */
export const MeetupGallery = ({
  meetup,
  isAttendee,
}: MeetupGalleryProps): ReactNode => {
  const currentUserId = useAppSelector((state) => state.user.user?.id);
  const { data: photos = [] } = useGetMeetupGalleryQuery(meetup.id, {
    skip: meetup.id === '',
  });
  // Previews are scraped server-side and fill in after the tiles first render.
  const { data: previews = [] } = useGetMeetupGalleryPreviewsQuery(meetup.id, {
    skip: meetup.id === '',
  });
  const previewById = new Map(previews.map((preview) => [preview.id, preview]));

  const isArchive = meetup.is_archive;

  // Organizers can add photos to their own meetup even without a ticket, matching
  // the backend's attendee-or-organizer gate.
  const isOrganizer =
    currentUserId != null &&
    (meetup.lead_organizer?.id === currentUserId ||
      (meetup.organizers?.some((organizer) => organizer.id === currentUserId) ??
        false));

  // Archives: only the organizer curates, with no per-person limit. Otherwise
  // adding needs an attendee/organizer and a meetup that's under way (the
  // backend rejects links before it starts).
  const canContribute = isArchive
    ? isOrganizer
    : (isAttendee || isOrganizer) && hasMeetupStarted(meetup);
  const alreadyContributed =
    currentUserId != null &&
    photos.some((photo) => photo.user_id === currentUserId);

  // Show the section if there's something to show, or the viewer can add.
  if (photos.length === 0 && !canContribute) return null;

  // A plain attendee holds at most one link per meetup, so hide the add tile
  // once they've contributed. An organizer can add many (their own plus
  // account-less credited links).
  const showAddTile = canContribute && (isOrganizer || !alreadyContributed);

  return (
    <div className="pb-4">
      <p className="pb-2 font-semibold">Photos</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo) => (
          <GalleryTile
            key={photo.id}
            meetupId={meetup.id}
            photo={photo}
            preview={previewById.get(photo.id)}
            isOwn={photo.user_id != null && photo.user_id === currentUserId}
            canModerate={isOrganizer}
          />
        ))}
        {showAddTile ? (
          <AddGalleryTile meetupId={meetup.id} isOrganizer={isOrganizer} />
        ) : null}
      </div>
    </div>
  );
};

interface GalleryTileProps {
  meetupId: string;
  photo: GalleryInfo;
  /** Server-scraped preview for this link, once it has loaded. */
  preview: GalleryPreview | undefined;
  isOwn: boolean;
  /** Organizers can remove any contributor's link, not just their own. */
  canModerate: boolean;
}

const GalleryTile = ({
  meetupId,
  photo,
  preview,
  isOwn,
  canModerate,
}: GalleryTileProps): ReactNode => {
  const navigate = useNavigate();
  return (
    <GalleryCard
      gallery={photo.gallery}
      preview={preview}
      subtitle={`by ${photo.display_name}`}
      actions={
        <GalleryActions
          meetupId={meetupId}
          photo={photo}
          isOwn={isOwn}
          canModerate={canModerate}
          onOpenProfile={
            photo.username != null
              ? () => void navigate(`/user/${photo.username}`)
              : undefined
          }
        />
      }
    />
  );
};

const AddGalleryTile = ({
  meetupId,
  isOrganizer,
}: {
  meetupId: string;
  isOrganizer: boolean;
}): ReactNode => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  // Organizers choose who took the photos: 'me' links the photo to their own
  // account, 'other' credits a typed name on an account-less link.
  const [contributorType, setContributorType] = useState<'' | 'me' | 'other'>(
    ''
  );
  const [contributorName, setContributorName] = useState('');
  const [createGallery, { isLoading }] = useCreateGalleryMutation();

  const reset = (): void => {
    setUrl('');
    setContributorType('');
    setContributorName('');
  };

  // Organizers must pick who took the photos; 'other' additionally needs a name.
  const choiceInvalid =
    isOrganizer &&
    (contributorType === '' ||
      (contributorType === 'other' && contributorName.trim() === ''));
  const submitDisabled = isLoading || url.trim() === '' || choiceInvalid;

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (url.trim() === '' || choiceInvalid) return;
    try {
      await createGallery({
        meetupId,
        gallery: url.trim(),
        // 'me' sends no name, so the backend links it to the organizer's account.
        contributorName:
          isOrganizer && contributorType === 'other'
            ? contributorName.trim()
            : undefined,
      }).unwrap();
      toast.success('Gallery added');
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to add gallery.'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:border-ring hover:text-foreground rounded-md border border-dashed transition-colors"
          aria-label="Add a gallery"
        >
          <AspectRatio ratio={1}>
            <div className="flex size-full flex-col items-center justify-center gap-1">
              <FiPlus className="size-6" />
              <span className="text-xs font-medium">Add gallery</span>
            </div>
          </AspectRatio>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a gallery</DialogTitle>
          <DialogDescription>
            {isOrganizer
              ? 'Add a link to photos from this meetup e.g. Imgur, Google Photos, etc., and choose who took them — you, or credit someone else like a photographer. Everyone viewing the meetup will be able to see it.'
              : 'Share a link to your photos from this meetup e.g. Imgur, Google Photos, etc. Everyone viewing the meetup will be able to see it.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          {isOrganizer ? (
            <Field className="mb-4">
              <FieldLabel htmlFor="gallery-contributor-type">
                Who took these?
              </FieldLabel>
              <Select
                value={contributorType}
                onValueChange={(value) => {
                  setContributorType(value as 'me' | 'other');
                  // Drop a stale name when switching back to self-credit.
                  if (value === 'me') setContributorName('');
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="gallery-contributor-type" className="w-full">
                  <SelectValue placeholder="Who took these photos?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">I took these</SelectItem>
                  <SelectItem value="other">Someone else took these</SelectItem>
                </SelectContent>
              </Select>
              {contributorType === 'other' ? (
                <Input
                  className="mt-2"
                  maxLength={30}
                  placeholder="Whose photos are these?"
                  value={contributorName}
                  onChange={(event) => setContributorName(event.target.value)}
                  disabled={isLoading}
                />
              ) : null}
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="gallery-url">Gallery</FieldLabel>
            <Input
              id="gallery-url"
              type="url"
              inputMode="url"
              autoFocus={!isOrganizer}
              placeholder="https://photos.example.com/…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={isLoading}
            />
          </Field>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitDisabled}>
              Add
              {isLoading && <Spinner />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
