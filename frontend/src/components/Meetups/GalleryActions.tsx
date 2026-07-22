import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { type GalleryInfo } from '@keebmeet/shared';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  FiAlertTriangle,
  FiCalendar,
  FiCopy,
  FiEdit2,
  FiMoreVertical,
  FiTrash2,
  FiUser,
  FiUserCheck,
} from 'react-icons/fi';
import { toast } from 'sonner';
import {
  useDeleteGalleryByIdMutation,
  useDeleteGalleryForUserMutation,
  useDeleteGalleryMutation,
  useEditGalleryMutation,
  useTransferGalleryMutation,
  useUploadGalleryImageMutation,
} from '../../store/gallerySlice';
import ImageUploadField from '../shared/ImageUploadField';
import { UserSearchInput } from '../shared/UserSearchInput';

/** Pull a human-readable message out of an RTK Query error, if any. */
export const errorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { data?: { message?: string } })?.data;
  return data?.message ?? fallback;
};

interface GalleryActionsProps {
  meetupId: string;
  photo: GalleryInfo;
  isOwn: boolean;
  /** Organizers can moderate any contributor's link, not just their own. */
  canModerate?: boolean;
  /** When set, adds an item that opens the gallery's meetup. */
  onOpenMeetup?: () => void;
  /** When set, adds an item that opens the contributor's profile. */
  onOpenProfile?: () => void;
}

/** Kebab menu (copy / edit / transfer / delete) plus its dialogs for a gallery. */
export const GalleryActions = ({
  meetupId,
  photo,
  isOwn,
  canModerate = false,
  onOpenMeetup,
  onOpenProfile,
}: GalleryActionsProps): ReactNode => {
  const [deleteOwn, { isLoading: isDeletingOwn }] = useDeleteGalleryMutation();
  const [deleteForUser, { isLoading: isDeletingForUser }] =
    useDeleteGalleryForUserMutation();
  const [deleteById, { isLoading: isDeletingById }] =
    useDeleteGalleryByIdMutation();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const canDelete = isOwn || canModerate;
  const canEdit = isOwn || canModerate;
  const canTransfer = canModerate && photo.user_id == null;
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
    <>
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
          {onOpenMeetup != null ? (
            <DropdownMenuItem onSelect={() => onOpenMeetup()}>
              <FiCalendar />
              Open meetup
            </DropdownMenuItem>
          ) : null}
          {onOpenProfile != null ? (
            <DropdownMenuItem onSelect={() => onOpenProfile()}>
              <FiUser />
              View profile
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => handleCopyUrl()}>
            <FiCopy />
            Copy URL
          </DropdownMenuItem>
          {canEdit || canTransfer || canDelete ? (
            <DropdownMenuSeparator />
          ) : null}
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
          {canTransfer ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setTransferOpen(true);
              }}
            >
              <FiUserCheck />
              Transfer to user
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                // Keep the menu's own close from stealing focus, then open the
                // confirmation dialog ourselves.
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
      {canEdit ? (
        <EditGalleryDialog
          meetupId={meetupId}
          photo={photo}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
      {canTransfer ? (
        <TransferGalleryDialog
          meetupId={meetupId}
          photo={photo}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      ) : null}
    </>
  );
};

const TransferGalleryDialog = ({
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
  const [username, setUsername] = useState('');
  const [transferGallery, { isLoading }] = useTransferGalleryMutation();

  useEffect(() => {
    if (open) setUsername('');
  }, [open]);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const handle = username.trim().replace(/^@/, '');
    if (handle === '') return;
    try {
      await transferGallery({
        meetupId,
        galleryId: photo.id,
        username: handle,
      }).unwrap();
      toast.success('Gallery transferred');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to transfer gallery.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer gallery</DialogTitle>
          <DialogDescription>
            Reassign {photo.display_name}'s credited gallery to a keebmeet
            account by username. They'll then own and manage it themselves.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <Field>
            <FieldLabel htmlFor="transfer-username">Username</FieldLabel>
            <UserSearchInput
              id="transfer-username"
              autoFocus
              value={username}
              onChange={setUsername}
              disabled={isLoading}
            />
          </Field>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isLoading || username.trim() === ''}
            >
              Transfer
              {isLoading && <Spinner />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [isUploading, setIsUploading] = useState(false);

  const [editGallery, { isLoading }] = useEditGalleryMutation();

  useEffect(() => {
    if (open) {
      setUrl(photo.gallery);
      setTitle(photo.title ?? '');
      setCoverKey(photo.cover_image_url ?? '');
      setCoverPreview(photo.cover_image_url ?? '');
    }
  }, [open, photo]);

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
          <ImageUploadField
            className="mt-4 max-w-40"
            label="Cover image"
            aspectRatio={1}
            previewUrl={coverPreview}
            useUploadMutation={useUploadGalleryImageMutation}
            onUploadingChange={setIsUploading}
            onUploaded={(imageKey, imageUrl) => {
              setCoverKey(imageKey);
              setCoverPreview(imageUrl);
            }}
            onRemove={() => {
              setCoverKey('');
              setCoverPreview('');
            }}
          />
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
