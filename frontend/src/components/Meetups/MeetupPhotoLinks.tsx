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
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  type MeetupInfo,
  type PhotoLinkInfo,
  type PhotoLinkPreview,
} from '@keebmeet/shared';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { FiAlertTriangle, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAppSelector } from '../../store/hooks';
import {
  useCreatePhotoLinkMutation,
  useDeletePhotoLinkForUserMutation,
  useDeletePhotoLinkMutation,
  useGetMeetupPhotoLinkPreviewsQuery,
  useGetMeetupPhotoLinksQuery,
} from '../../store/photoLinkSlice';
import { hasMeetupStarted } from '../../util/timeUtil';

interface MeetupPhotoLinksProps {
  meetup: MeetupInfo;
  /** Whether the viewer holds a ticket for this meetup. */
  isAttendee: boolean;
}

/** Best-effort hostname for the tile caption; falls back to the raw link. */
const linkLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Pull a human-readable message out of an RTK Query error, if any. */
const errorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { data?: { message?: string } })?.data;
  return data?.message ?? fallback;
};

/**
 * Photos section for a meetup: contributors' photo links rendered as tiles.
 * Shown when the meetup already has links, or when a started meetup is being
 * viewed by an attendee (who can then add their own).
 */
export const MeetupPhotoLinks = ({
  meetup,
  isAttendee,
}: MeetupPhotoLinksProps): ReactNode => {
  const currentUserId = useAppSelector((state) => state.user.user?.id);
  const { data: photos = [] } = useGetMeetupPhotoLinksQuery(meetup.id, {
    skip: meetup.id === '',
  });
  // Previews are scraped server-side and fill in after the tiles first render.
  const { data: previews = [] } = useGetMeetupPhotoLinkPreviewsQuery(
    meetup.id,
    {
      skip: meetup.id === '',
    }
  );
  const previewByUser = new Map(
    previews.map((preview) => [preview.user_id, preview])
  );

  // Organizers can add photos to their own meetup even without a ticket, matching
  // the backend's attendee-or-organizer gate.
  const isOrganizer =
    currentUserId != null &&
    (meetup.lead_organizer?.id === currentUserId ||
      (meetup.organizers?.some((organizer) => organizer.id === currentUserId) ??
        false));

  // Adding is only possible once the meetup is under way (the backend rejects
  // links before it starts) and only for attendees or organizers.
  const canContribute = (isAttendee || isOrganizer) && hasMeetupStarted(meetup);
  const alreadyContributed =
    currentUserId != null &&
    photos.some((photo) => photo.user_id === currentUserId);

  // Show the section if there's something to show, or the viewer can add.
  if (photos.length === 0 && !canContribute) return null;

  // A user may hold at most one link per meetup, so hide the add tile once
  // they've contributed (they'd delete and re-add to change it).
  const showAddTile = canContribute && !alreadyContributed;

  return (
    <div className="pb-4">
      <p className="pb-2 font-semibold">Photos</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo) => (
          <PhotoTile
            key={photo.user_id}
            meetupId={meetup.id}
            photo={photo}
            preview={previewByUser.get(photo.user_id)}
            isOwn={photo.user_id === currentUserId}
            canModerate={isOrganizer}
          />
        ))}
        {showAddTile ? <AddPhotoTile meetupId={meetup.id} /> : null}
      </div>
    </div>
  );
};

interface PhotoTileProps {
  meetupId: string;
  photo: PhotoLinkInfo;
  /** Server-scraped preview for this link, once it has loaded. */
  preview: PhotoLinkPreview | undefined;
  isOwn: boolean;
  /** Organizers can remove any contributor's link, not just their own. */
  canModerate: boolean;
}

const PhotoTile = ({
  meetupId,
  photo,
  preview,
  isOwn,
  canModerate,
}: PhotoTileProps): ReactNode => {
  const [deleteOwn, { isLoading: isDeletingOwn }] =
    useDeletePhotoLinkMutation();
  const [deleteForUser, { isLoading: isDeletingForUser }] =
    useDeletePhotoLinkForUserMutation();
  const [open, setOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const canDelete = isOwn || canModerate;
  const isLoading = isDeletingOwn || isDeletingForUser;

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    // Removing someone else's contribution gets a short cooldown so it can't be
    // fired off by reflex; deleting your own is immediate.
    if (next) setCooldown(isOwn ? 0 : 3);
  };

  // Tick the delete cooldown down while the confirmation is open.
  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, cooldown]);

  const handleDelete = async (): Promise<void> => {
    try {
      // Owners use the self-service route; organizers removing someone else's
      // link go through the target_user_id moderation route.
      if (isOwn) {
        await deleteOwn(meetupId).unwrap();
      } else {
        await deleteForUser({ meetupId, targetUserId: photo.user_id }).unwrap();
      }
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to remove photo link.'));
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-md border">
      <a href={photo.photo_link} target="_blank" rel="noopener noreferrer">
        <AspectRatio ratio={1}>
          <ImageWithFallback
            src={preview?.image ?? photo.photo_link}
            resizeWidth={256}
            className="size-full object-cover"
          />
        </AspectRatio>
        <div className="p-2 text-xs">
          <p className="truncate font-medium">
            {preview?.title ?? preview?.siteName ?? linkLabel(photo.photo_link)}
          </p>
          <p className="text-muted-foreground truncate">
            Added by {photo.display_name}
          </p>
        </div>
      </a>
      {canDelete ? (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              title={isOwn ? 'Remove your photo link' : 'Remove photo link'}
              aria-label={
                isOwn ? 'Remove your photo link' : 'Remove photo link'
              }
              className="absolute top-1 right-1 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            >
              <FiTrash2 />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isOwn
                  ? 'Remove your photo link?'
                  : `Remove ${photo.display_name}'s photo link?`}
              </DialogTitle>
              <DialogDescription>
                {isOwn
                  ? 'This removes your photo link from this meetup. You can add a new one afterwards.'
                  : "This removes a contributor's photo link from this meetup. This can't be undone."}
              </DialogDescription>
              {!isOwn ? (
                <div className="border-destructive/50 bg-destructive/10 text-destructive mt-2 flex items-start gap-2 rounded-md border p-3 text-sm">
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  <p>
                    This is{' '}
                    <span className="font-semibold">not your photo link</span> —
                    you're removing{' '}
                    <span className="font-semibold">{photo.display_name}</span>
                    's contribution as an organizer.
                  </p>
                </div>
              ) : null}
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={cooldown > 0 || isLoading}
                onClick={() => void handleDelete()}
              >
                {cooldown > 0 ? `Remove (${cooldown})` : 'Remove'}
                {isLoading && <Spinner />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};

const AddPhotoTile = ({ meetupId }: { meetupId: string }): ReactNode => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [createPhotoLink, { isLoading }] = useCreatePhotoLinkMutation();

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (url.trim() === '') return;
    try {
      await createPhotoLink({ meetupId, photoLink: url.trim() }).unwrap();
      toast.success('Photo link added');
      setOpen(false);
      setUrl('');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to add photo link.'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setUrl('');
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:border-ring hover:text-foreground rounded-md border border-dashed transition-colors"
          aria-label="Add a photo link"
        >
          <AspectRatio ratio={1}>
            <div className="flex size-full flex-col items-center justify-center gap-1">
              <FiPlus className="size-6" />
              <span className="text-xs font-medium">Add photos</span>
            </div>
          </AspectRatio>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a photo link</DialogTitle>
          <DialogDescription>
            Share a link to your photos from this meetup e.g. Imgur, Google
            Photos, etc. Everyone viewing the meetup will be able to see it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <Field>
            <FieldLabel htmlFor="photo-link-url">Photo link</FieldLabel>
            <Input
              id="photo-link-url"
              type="url"
              inputMode="url"
              autoFocus
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
            <Button type="submit" disabled={isLoading || url.trim() === ''}>
              Add
              {isLoading && <Spinner />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
