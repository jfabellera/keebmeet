import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { type User } from '../../../backend/src/interfaces/userInterfaces';
import { setUserAccess } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useGetAllUsersQuery } from '../store/userSlice';

const AdminUsersPage = (): ReactNode => {
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAppSelector((state) => state.user);
  const { data: users, isLoading, refetch } = useGetAllUsersQuery();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'organizers' | 'admins'>(
    'all'
  );
  // The user id currently being saved, so we can disable its row while in flight.
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

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
        (roleFilter === 'admins' && user.is_admin);
      return matchesSearch && matchesRole;
    });
    // Stable alphabetical order so rows don't jump around after an update (the
    // API returns users in no particular order).
    return [...matched].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, undefined, {
        sensitivity: 'base',
      })
    );
  }, [users, search, roleFilter]);

  const roleFilters: Array<{
    value: 'all' | 'organizers' | 'admins';
    label: string;
  }> = [
    { value: 'all', label: 'All' },
    { value: 'organizers', label: 'Organizers' },
    { value: 'admins', label: 'Admins' },
  ];

  const updateAccess = (
    user: User,
    changes: { isAdmin?: boolean; isOrganizer?: boolean }
  ): void => {
    void (async () => {
      setSavingUserId(user.id);
      try {
        await dispatch(
          setUserAccess({
            userId: user.id,
            isAdmin: changes.isAdmin ?? user.is_admin,
            isOrganizer: changes.isOrganizer ?? user.is_organizer,
          })
        ).unwrap();
        await refetch();
        toast.success(`Updated ${user.display_name}.`);
      } catch {
        toast.error(`Could not update ${user.display_name}. Please try again.`);
      } finally {
        setSavingUserId(null);
      }
    })();
  };

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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Organizer</TableHead>
              <TableHead className="text-center">Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const isSaving = savingUserId === user.id;
              // Guard against an admin removing their own admin access and
              // locking themselves out of this page.
              const isSelf = currentUser?.id === user.id;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.display_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={user.is_organizer}
                      disabled={isSaving}
                      onCheckedChange={(checked) =>
                        updateAccess(user, { isOrganizer: checked })
                      }
                      aria-label={`Toggle organizer for ${user.display_name}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={user.is_admin}
                      disabled={isSaving || isSelf}
                      onCheckedChange={(checked) =>
                        updateAccess(user, { isAdmin: checked })
                      }
                      aria-label={`Toggle admin for ${user.display_name}`}
                    />
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
    </div>
  );
};

export default AdminUsersPage;
