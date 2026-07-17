import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type User } from '@keebmeet/shared';
import dayjs from 'dayjs';
import { useMemo, useState, type ReactNode } from 'react';
import { FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { setUserAccess } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useGetAllUsersQuery } from '../store/userSlice';

type SortKey = 'name' | 'email' | 'created_at';
type SortDirection = 'asc' | 'desc';

const SortableHead = ({
  label,
  sortKey,
  sort,
  onSort,
  center = false,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
  center?: boolean;
}): ReactNode => {
  const active = sort.key === sortKey;
  return (
    <TableHead className={center ? 'text-center' : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={`hover:text-foreground inline-flex items-center gap-1 transition-colors ${
          center ? 'mx-auto' : ''
        } ${active ? 'text-foreground' : ''}`}
      >
        {label}
        {active ? (
          sort.direction === 'asc' ? (
            <FiChevronUp className="size-3.5" />
          ) : (
            <FiChevronDown className="size-3.5" />
          )
        ) : (
          <FiChevronDown className="size-3.5 opacity-30" />
        )}
      </button>
    </TableHead>
  );
};

const AdminUsersPage = (): ReactNode => {
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAppSelector((state) => state.user);
  const { data: users, isLoading, refetch } = useGetAllUsersQuery();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<
    'all' | 'organizers' | 'admins' | 'owners'
  >('all');
  // The user id currently being saved, so we can disable its row while in flight.
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  // An in-progress admin-status change awaiting password confirmation.
  const [pendingAdminChange, setPendingAdminChange] = useState<{
    user: User;
    nextValue: boolean;
  } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });

  const toggleSort = (key: SortKey): void => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = (users ?? []).filter((user) => {
      const matchesSearch =
        query === '' ||
        user.display_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);
      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'organizers' && user.is_organizer) ||
        (roleFilter === 'admins' && user.is_admin) ||
        (roleFilter === 'owners' && user.is_owner);
      return matchesSearch && matchesRole;
    });

    const compare = (a: User, b: User): number => {
      switch (sort.key) {
        case 'email':
          return a.email.localeCompare(b.email, undefined, {
            sensitivity: 'base',
          });
        case 'created_at':
          return dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf();
        case 'name':
        default:
          return a.display_name.localeCompare(b.display_name, undefined, {
            sensitivity: 'base',
          });
      }
    };

    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...matched].sort((a, b) => {
      const primary = compare(a, b) * direction;
      if (primary !== 0) return primary;
      return a.display_name.localeCompare(b.display_name, undefined, {
        sensitivity: 'base',
      });
    });
  }, [users, search, roleFilter, sort]);

  const roleFilters: Array<{
    value: 'all' | 'organizers' | 'admins' | 'owners';
    label: string;
  }> = [
    { value: 'all', label: 'All' },
    { value: 'organizers', label: 'Organizers' },
    { value: 'admins', label: 'Admins' },
    { value: 'owners', label: 'Owners' },
  ];

  const updateAccess = async (
    user: User,
    changes: { isAdmin?: boolean; isOrganizer?: boolean },
    currentPassword?: string
  ): Promise<boolean> => {
    setSavingUserId(user.id);
    try {
      await dispatch(
        setUserAccess({
          userId: user.id,
          isAdmin: changes.isAdmin ?? user.is_admin,
          isOrganizer: changes.isOrganizer ?? user.is_organizer,
          currentPassword,
        })
      ).unwrap();
      await refetch();
      toast.success(`Updated ${user.display_name}.`);
      return true;
    } catch (err) {
      // The auth server rejects a wrong/missing password with a 401.
      if (currentPassword != null && err === 401) {
        toast.error('Incorrect password.');
      } else {
        toast.error(`Could not update ${user.display_name}. Please try again.`);
      }
      return false;
    } finally {
      setSavingUserId(null);
    }
  };

  // Toggling admin status requires the acting user to confirm with their own
  // password, so it goes through a confirmation dialog rather than firing
  // immediately.
  const confirmAdminChange = (): void => {
    if (pendingAdminChange == null) return;
    void (async () => {
      const succeeded = await updateAccess(
        pendingAdminChange.user,
        { isAdmin: pendingAdminChange.nextValue },
        confirmPassword
      );
      if (succeeded) {
        setPendingAdminChange(null);
      }
      setConfirmPassword('');
    })();
  };

  const closeAdminDialog = (): void => {
    setPendingAdminChange(null);
    setConfirmPassword('');
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
      <h1 className="text-2xl font-semibold">Manage users</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="bg-card max-w-sm"
        />
        <div className="flex gap-1">
          {roleFilters.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={roleFilter === filter.value ? 'default' : 'outline'}
              onClick={() => setRoleFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="bg-card text-card-foreground rounded-lg p-2 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <SortableHead
                label="Name"
                sortKey="name"
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHead
                label="Email"
                sortKey="email"
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHead
                label="Joined"
                sortKey="created_at"
                sort={sort}
                onSort={toggleSort}
              />
              <TableHead className="text-center">Organizer</TableHead>
              <TableHead className="text-center">Admin</TableHead>
              <TableHead className="text-center">Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const isSaving = savingUserId === user.id;
              // Guard against removing your own elevated access and locking
              // yourself out of this page.
              const isSelf = currentUser?.id === user.id;
              const isOwner = currentUser?.isOwner ?? false;
              // Only owners may change owner status or an owner's admin status.
              const canEditAdmin = isOwner || !user.is_owner;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link
                      to={`/user/${user.username}`}
                      aria-label={`View ${user.display_name}'s profile`}
                    >
                      <Avatar>
                        <AvatarImage
                          src={user.photo_url}
                          alt={`${user.display_name}'s avatar`}
                        />
                        <AvatarFallback>
                          {user.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      to={`/user/${user.username}`}
                      className="hover:underline"
                    >
                      {user.display_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {dayjs(user.created_at).format('MMM D, YYYY h:mm A')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={user.is_organizer}
                      disabled={isSaving}
                      onCheckedChange={(checked) => {
                        void updateAccess(user, { isOrganizer: checked });
                      }}
                      aria-label={`Toggle organizer for ${user.display_name}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={user.is_admin}
                      disabled={isSaving || isSelf || !canEditAdmin}
                      onCheckedChange={(checked) => {
                        setConfirmPassword('');
                        setPendingAdminChange({ user, nextValue: checked });
                      }}
                      aria-label={`Toggle admin for ${user.display_name}`}
                    />
                  </TableCell>
                  {/* Owner status is managed directly in the database, so it's
                      read-only here. */}
                  <TableCell className="text-center">
                    {user.is_owner ? (
                      <FiCheck
                        className="mx-auto size-4"
                        aria-label={`${user.display_name} is an owner`}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!isLoading && filteredUsers.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">
            {users != null && users.length > 0
              ? 'No users match your search.'
              : 'No users found.'}
          </p>
        ) : null}
      </div>

      <Dialog
        open={pendingAdminChange != null}
        onOpenChange={(open) => {
          if (!open) closeAdminDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm your password</DialogTitle>
            <DialogDescription>
              {pendingAdminChange != null
                ? `Enter your password to ${
                    pendingAdminChange.nextValue ? 'grant' : 'revoke'
                  } admin access for ${pendingAdminChange.user.display_name}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoFocus
            placeholder="Your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirmAdminChange();
            }}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={closeAdminDialog}>
              Cancel
            </Button>
            <Button
              onClick={confirmAdminChange}
              disabled={
                confirmPassword === '' ||
                savingUserId === pendingAdminChange?.user.id
              }
            >
              Confirm
              {savingUserId === pendingAdminChange?.user.id && <Spinner />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPage;
