import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type GroupInfo } from '@keebmeet/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { CopyButton } from '../components/CopyButton';
import {
  useCreateGroupMutation,
  useDeleteGroupMutation,
  useEditGroupMutation,
  useGetGroupsQuery,
} from '../store/groupSlice';

interface GroupForm {
  name: string;
  code: string;
  discord_server_id: string;
}

const emptyForm: GroupForm = { name: '', code: '', discord_server_id: '' };

const AdminGroupsPage = (): ReactNode => {
  const { data: groups, isLoading } = useGetGroupsQuery();
  const [createGroup, { isLoading: isCreating }] = useCreateGroupMutation();
  const [editGroup, { isLoading: isEditing }] = useEditGroupMutation();
  const [deleteGroup, { isLoading: isDeleting }] = useDeleteGroupMutation();

  // The group being edited, or null when the dialog is creating a new one. The
  // dialog opens whenever `form` is non-null.
  const [editing, setEditing] = useState<GroupInfo | null>(null);
  const [form, setForm] = useState<GroupForm | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GroupInfo | null>(null);

  const isSaving = isCreating || isEditing;

  const openCreate = (): void => {
    setEditing(null);
    setForm(emptyForm);
  };

  const openEdit = (group: GroupInfo): void => {
    setEditing(group);
    setForm({
      name: group.name,
      code: group.code,
      discord_server_id: group.discord_server_id ?? '',
    });
  };

  const closeDialog = (): void => {
    setForm(null);
    setEditing(null);
  };

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (form == null) return;

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      discord_server_id: form.discord_server_id.trim(),
    };

    void (async () => {
      try {
        if (editing != null) {
          await editGroup({ groupId: editing.id, changes: payload }).unwrap();
          toast.success(`Updated ${payload.name}.`);
        } else {
          await createGroup(payload).unwrap();
          toast.success(`Created ${payload.name}.`);
        }
        closeDialog();
      } catch (err) {
        // The API rejects a duplicate code with a 409.
        const status = (err as { status?: number }).status;
        if (status === 409) {
          toast.error('That group code is already taken.');
        } else {
          toast.error('Could not save the group. Please try again.');
        }
      }
    })();
  };

  const onDelete = (): void => {
    if (pendingDelete == null) return;
    void (async () => {
      try {
        await deleteGroup(pendingDelete.id).unwrap();
        toast.success(`Deleted ${pendingDelete.name}.`);
        setPendingDelete(null);
      } catch {
        toast.error('Could not delete the group. Please try again.');
      }
    })();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manage groups</h1>
        <Button onClick={openCreate}>
          <FiPlus />
          New group
        </Button>
      </div>

      <div className="bg-card text-card-foreground rounded-lg p-2 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Discord server</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(groups ?? []).map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium">{group.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono">
                  <span className="inline-flex items-center gap-1">
                    {group.code}
                    <CopyButton
                      value={group.code}
                      label={`Copy code ${group.code}`}
                      toastMessage="Code copied to clipboard"
                      className="size-6"
                    />
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono">
                  {group.discord_server_id ?? (
                    <span className="font-sans">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(group)}
                      aria-label={`Edit ${group.name}`}
                    >
                      <FiEdit2 />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingDelete(group)}
                      aria-label={`Delete ${group.name}`}
                    >
                      <FiTrash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {groups == null || groups.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">
            No groups yet. Create one to get started.
          </p>
        ) : null}
      </div>

      {/* Create / edit dialog */}
      <Dialog
        open={form != null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editing != null ? 'Edit group' : 'New group'}
              </DialogTitle>
              <DialogDescription>
                {editing != null
                  ? 'Update this group’s details.'
                  : 'Create a group with a unique code.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="group-name">Name</Label>
                <Input
                  id="group-name"
                  autoFocus
                  value={form?.name ?? ''}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev != null
                        ? { ...prev, name: event.target.value }
                        : prev
                    )
                  }
                  placeholder="Group name"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="group-code">Code</Label>
                <Input
                  id="group-code"
                  value={form?.code ?? ''}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev != null
                        ? { ...prev, code: event.target.value }
                        : prev
                    )
                  }
                  placeholder="group-code"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="group-discord">Discord server ID</Label>
                <Input
                  id="group-discord"
                  value={form?.discord_server_id ?? ''}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev != null
                        ? { ...prev, discord_server_id: event.target.value }
                        : prev
                    )
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSaving ||
                  form == null ||
                  form.name.trim().length < 3 ||
                  form.code.trim() === ''
                }
              >
                {editing != null ? 'Save' : 'Create'}
                {isSaving && <Spinner />}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group</DialogTitle>
            <DialogDescription>
              {pendingDelete != null
                ? `Are you sure you want to delete ${pendingDelete.name}? This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isDeleting}
            >
              Delete
              {isDeleting && <Spinner />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGroupsPage;
