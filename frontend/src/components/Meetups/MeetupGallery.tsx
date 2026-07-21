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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
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
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  FiAlertTriangle,
  FiCopy,
  FiEdit2,
  FiMoreVertical,
  FiPlus,
  FiTrash2,
  FiUpload,
  FiX,
} from 'react-icons/fi';
import { toast } from 'sonner';
import {
  useCreateGalleryMutation,
  useDeleteGalleryByIdMutation,
  useDeleteGalleryForUserMutation,
  useDeleteGalleryMutation,
  useEditGalleryMutation,
  useGetMeetupGalleryPreviewsQuery,
  useGetMeetupGalleryQuery,
  useUploadGalleryImageMutation,
} from '../../store/gallerySlice';
import { useAppSelector } from '../../store/hooks';
import { hasMeetupStarted } from '../../util/timeUtil';

interface MeetupGalleryProps {
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
  const [deleteOwn, { isLoading: isDeletingOwn }] = useDeleteGalleryMutation();
  const [deleteForUser, { isLoading: isDeletingForUser }] =
    useDeleteGalleryForUserMutation();
  const [deleteById, { isLoading: isDeletingById }] =
    useDeleteGalleryByIdMutation();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const canDelete = isOwn || canModerate;
  const canEdit = isOwn || canModerate;
  const isLoading = isDeletingOwn || isDeletingForUser || isDeletingById;

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

  const handleCopyUrl = (): void => {
    void navigator.clipboard.writeText(photo.gallery);
    toast.success('Gallery URL copied to clipboard');
  };

  const handleDelete = async (): Promise<void> => {
    try {
      // Account-less credited links (no user_id) are removed by record id.
      // Otherwise owners use the self-service route and organizers removing
      // someone else's link go through the target_user_id moderation route.
      if (photo.user_id == null) {
        await deleteById({ meetupId, galleryId: photo.id }).unwrap();
      } else if (isOwn) {
        await deleteOwn(meetupId).unwrap();
      } else {
        await deleteForUser({
          meetupId,
          targetUserId: photo.user_id,
        }).unwrap();
      }
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to remove gallery.'));
    }
  };

  return (
    <div className="overflow-hidden rounded-md border">
      <a href={photo.gallery} target="_blank" rel="noopener noreferrer">
        <AspectRatio ratio={1}>
          <ImageWithFallback
            src={preview?.image ?? photo.gallery}
            resizeWidth={256}
            className="size-full object-cover"
          />
        </AspectRatio>
      </a>
      <div className="flex items-start gap-1 p-2 text-xs">
        <a
          href={photo.gallery}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1"
        >
          <p className="truncate font-medium">
            {preview?.title ?? preview?.siteName ?? linkLabel(photo.gallery)}
          </p>
          <p className="text-muted-foreground truncate">
            by {photo.display_name}
          </p>
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Gallery options"
              className="-mt-0.5 -mr-1 size-7 shrink-0"
            >
              <FiMoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => handleCopyUrl()}>
              <FiCopy />
              Copy URL
            </DropdownMenuItem>
            {canEdit ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setEditOpen(true);
                }}
              >
                <FiEdit2 />
                Edit
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  // Keep the menu's own close from stealing focus, then open
                  // the confirmation dialog ourselves.
                  event.preventDefault();
                  handleOpenChange(true);
                }}
              >
                <FiTrash2 />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Kept a sibling of the menu, not nested inside it, so the two Radix
            layers don't fight over pointer capture / dismissal. */}
        {canDelete ? (
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isOwn
                    ? 'Remove your gallery?'
                    : `Remove ${photo.display_name}'s gallery?`}
                </DialogTitle>
                <DialogDescription>
                  {isOwn
                    ? 'This removes your gallery from this meetup. You can add a new one afterwards.'
                    : "This removes a contributor's gallery from this meetup. This can't be undone."}
                </DialogDescription>
                {!isOwn ? (
                  <div className="border-destructive/50 bg-destructive/10 text-destructive mt-2 flex items-start gap-2 rounded-md border p-3 text-sm">
                    <FiAlertTriangle className="mt-0.5 shrink-0" />
                    <p>
                      This is{' '}
                      <span className="font-semibold">not your gallery</span> —
                      you're removing{' '}
                      <span className="font-semibold">
                        {photo.display_name}
                      </span>
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
        {canEdit ? (
          <EditGalleryDialog
            meetupId={meetupId}
            photo={photo}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        ) : null}
      </div>
    </div>
  );
};

const EditGalleryDialog = ({
  meetupId,
  photo,
  open,
  onOpenChange,
}: {
  meetupId: string;
  photo: GalleryInfo;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}): ReactNode => {
  const [url, setUrl] = useState(photo.gallery);
  const [title, setTitle] = useState(photo.title ?? '');
  const [coverKey, setCoverKey] = useState(photo.cover_image_url ?? '');
  const [coverPreview, setCoverPreview] = useState(photo.cover_image_url ?? '');
  const fileInput = useRef<HTMLInputElement>(null);

  const [editGallery, { isLoading }] = useEditGalleryMutation();
  const [uploadImage, { isLoading: isUploading }] =
    useUploadGalleryImageMutation();

  useEffect(() => {
    if (open) {
      setUrl(photo.gallery);
      setTitle(photo.title ?? '');
      setCoverKey(photo.cover_image_url ?? '');
      setCoverPreview(photo.cover_image_url ?? '');
    }
  }, [open, photo]);

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (file == null) return;
    try {
      const { image_key, image_url } = await uploadImage({
        meetupId,
        file,
      }).unwrap();
      setCoverKey(image_key);
      setCoverPreview(image_url);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to upload image.'));
    }
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (url.trim() === '') return;
    try {
      await editGallery({
        meetupId,
        galleryId: photo.id,
        gallery: url.trim(),
        title: title.trim() === '' ? null : title.trim(),
        coverImageKey: coverKey,
      }).unwrap();
      toast.success('Gallery updated');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update gallery.'));
    }
  };

  const busy = isLoading || isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit gallery</DialogTitle>
          <DialogDescription>
            Change the link, or set a title and cover image to show instead of
            the auto-generated preview.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <Field>
            <FieldLabel htmlFor="edit-gallery-url">Gallery link</FieldLabel>
            <Input
              id="edit-gallery-url"
              type="url"
              inputMode="url"
              placeholder="https://photos.example.com/…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={busy}
            />
          </Field>
          <Field className="mt-4">
            <FieldLabel htmlFor="edit-gallery-title">Title</FieldLabel>
            <Input
              id="edit-gallery-title"
              maxLength={200}
              placeholder="Leave blank to use the auto-fetched title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
            />
          </Field>
          <Field className="mt-4">
            <FieldLabel>Cover image</FieldLabel>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            {coverPreview !== '' ? (
              <div className="flex items-center justify-between gap-2">
                <img
                  src={coverPreview}
                  alt=""
                  className="size-16 rounded-md border object-cover"
                />
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    {isUploading ? <Spinner /> : <FiUpload />}
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setCoverKey('');
                      setCoverPreview('');
                    }}
                  >
                    <FiX />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {isUploading ? <Spinner /> : <FiUpload />}
                Upload cover image
              </Button>
            )}
          </Field>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy || url.trim() === ''}>
              Save
              {isLoading && <Spinner />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
