import { Badge } from '@/components/ui/badge';
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
import { Spinner } from '@/components/ui/spinner';
import { type GroupInfo } from '@keebmeet/shared';
import { type FormEvent, type ReactNode, useState } from 'react';
import { FiUsers, FiX } from 'react-icons/fi';
import { toast } from 'sonner';
import {
  useGetMyGroupsQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
} from '../../store/groupSlice';

const GroupsCard = (): ReactNode => {
  const { data: groups, isLoading } = useGetMyGroupsQuery();
  const [joinGroup, { isLoading: isJoining }] = useJoinGroupMutation();
  const [leaveGroup, { isLoading: isLeaving }] = useLeaveGroupMutation();
  const [code, setCode] = useState('');
  // The group awaiting leave confirmation; the dialog is open while non-null.
  const [pendingLeave, setPendingLeave] = useState<GroupInfo | null>(null);

  const onJoin = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed === '') return;

    void (async () => {
      try {
        const group = await joinGroup({ code: trimmed }).unwrap();
        toast.success(`Joined ${group.name}.`);
        setCode('');
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          toast.error('No group found with that code.');
        } else if (status === 409) {
          toast.error("You're already in that group.");
        } else {
          toast.error('Could not join the group. Please try again.');
        }
      }
    })();
  };

  const onConfirmLeave = (): void => {
    if (pendingLeave == null) return;
    const group = pendingLeave;
    void (async () => {
      try {
        await leaveGroup(group.id).unwrap();
        toast.success(`Left ${group.name}.`);
        setPendingLeave(null);
      } catch {
        toast.error('Could not leave the group. Please try again.');
      }
    })();
  };

  return (
    <div className="bg-card text-card-foreground flex flex-col gap-4 rounded-lg p-8 shadow-lg">
      <h2 className="text-lg font-medium">Groups</h2>

      <form onSubmit={onJoin} className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter a group code"
          aria-label="Group code"
          className="flex-1"
        />
        <Button type="submit" disabled={isJoining || code.trim() === ''}>
          Join
          {isJoining ? <Spinner /> : null}
        </Button>
      </form>

      {isLoading ? (
        <div className="flex h-16 items-center justify-center">
          <Spinner />
        </div>
      ) : groups == null || groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          You haven't joined any groups yet. Enter a code above to join one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li
              key={group.id}
              className="bg-muted/40 flex items-center justify-between gap-4 rounded-md px-3 py-2"
            >
              <span className="flex items-center gap-2">
                <FiUsers className="text-muted-foreground size-4 shrink-0" />
                <span className="font-medium">{group.name}</span>
                {group.membership_source !== 'explicit' && (
                  <Badge variant="secondary">via Discord</Badge>
                )}
              </span>
              {group.membership_source !== 'discord' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingLeave(group)}
                  aria-label={`Leave ${group.name}`}
                >
                  <FiX />
                  Leave
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={pendingLeave != null}
        onOpenChange={(open) => {
          if (!open) setPendingLeave(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave group</DialogTitle>
            <DialogDescription>
              {pendingLeave != null
                ? `Are you sure you want to leave ${pendingLeave.name}? You'll need the code to rejoin.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPendingLeave(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmLeave}
              disabled={isLeaving}
            >
              Leave
              {isLeaving ? <Spinner /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupsCard;
