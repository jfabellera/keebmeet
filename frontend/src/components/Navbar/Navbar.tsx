import { ModeToggle } from '@/components/mode-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { meetupSlice } from '@/store/meetupSlice';
import { type ReactNode } from 'react';
import { type IconType } from 'react-icons';
import { FiLogOut, FiMenu, FiShield, FiUser } from 'react-icons/fi';
import { MdDashboardCustomize } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../store/authSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  useGetOrganizerRequestsQuery,
  useGetUserQuery,
} from '../../store/userSlice';

/**
 * Adapted from https://chakra-templates.dev/navigation/navbar
 */

interface LinkItemProps {
  name: string;
  url: string;
  icon: IconType;
  organizerOnly?: boolean;
  adminOnly?: boolean;
}

/**
 * Items to be placed in the navbar dropdown.
 */
const LinkItems: LinkItemProps[] = [
  // { name: 'Home', url: '.', icon: FiHome },
  {
    name: 'Organizer Dashboard',
    url: '/organizer',
    icon: MdDashboardCustomize,
    organizerOnly: true,
  },
  {
    name: 'Admin',
    url: '/admin',
    icon: FiShield,
    adminOnly: true,
  },
  {
    name: 'Account',
    url: '/account',
    icon: FiUser,
  },
];

interface NavbarProps {
  sidebar?: boolean;
  onOpen?: () => void;
}

const Nav = ({ sidebar, onOpen }: NavbarProps): ReactNode => {
  const { isLoggedIn, user } = useAppSelector((state) => state.user);
  const navigate = useNavigate();

  return (
    <div className="bg-background flex h-16 w-full items-center gap-1 border-b px-4">
      {sidebar === true ? (
        <Button
          variant="outline"
          size="icon"
          className="mr-2 md:hidden"
          onClick={onOpen}
          aria-label="menu"
        >
          <FiMenu />
        </Button>
      ) : null}
      <span
        role="button"
        tabIndex={0}
        className="text-primary cursor-pointer text-3xl font-bold tracking-tight"
        onClick={() => {
          void navigate('/');
        }}
      >
        KeebMeet
      </span>
      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
        {isLoggedIn && user != null ? (
          <NavbarDropdown
            userId={user.id}
            nickname={user.displayName}
            isOrganizer={user.isOrganizer}
            isAdmin={user.isAdmin || user.isOwner}
          />
        ) : (
          <GuestButtons />
        )}
      </div>
    </div>
  );
};

/**
 * Sign in and sign up buttons for when a user is not logged in.
 */
const GuestButtons = (): ReactNode => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-row items-center justify-end gap-2">
      <Button
        variant="link"
        className="text-sm font-normal"
        onClick={() => {
          void navigate('/login');
        }}
      >
        Sign In
      </Button>
      <Button
        className="font-semibold"
        onClick={() => {
          void navigate('/register');
        }}
      >
        Sign Up
      </Button>
    </div>
  );
};

interface NavbarDropdownProps {
  userId: string;
  nickname: string;
  isOrganizer: boolean;
  isAdmin: boolean;
}

const NavbarDropdown = ({
  userId,
  nickname,
  isOrganizer,
  isAdmin,
}: NavbarDropdownProps): ReactNode => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data: profile } = useGetUserQuery(userId);
  const avatarSrc = profile?.photo_url ?? '';

  // Surface pending organizer requests to admins. The endpoint is admin-only,
  // so skip the query for everyone else.
  const { data: organizerRequests } = useGetOrganizerRequestsQuery(undefined, {
    skip: !isAdmin,
  });
  const pendingRequestCount = organizerRequests?.length ?? 0;

  const prefetchOrganizerDashboard = meetupSlice.usePrefetch('getMeetups');
  const handlePrefetchOrganizerDashboard = (): void => {
    prefetchOrganizerDashboard({
      by_organizer_id: [userId],
      detail_level: 'detailed',
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-full" aria-label="account menu">
          <Avatar className="size-8">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback>
              <FiUser />
            </AvatarFallback>
          </Avatar>
          {/* Notify admins of pending requests without opening the menu. */}
          {pendingRequestCount > 0 ? (
            <span
              className="border-background absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 bg-red-500"
              aria-label={`${pendingRequestCount} pending organizer requests`}
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col items-center gap-2 p-2">
          <Avatar className="size-24">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback>
              <FiUser className="size-10" />
            </AvatarFallback>
          </Avatar>
          <p>{nickname}</p>
        </div>
        <DropdownMenuSeparator />
        {LinkItems.filter(
          (link) =>
            (link.organizerOnly !== true || isOrganizer) &&
            (link.adminOnly !== true || isAdmin)
        ).map((link) => (
          <NavItem
            key={link.name}
            icon={link.icon}
            badge={link.url === '/admin' ? pendingRequestCount : undefined}
            onClick={() => {
              void navigate(link.url);
            }}
            onMouseEnter={
              link.url === '/organizer'
                ? handlePrefetchOrganizerDashboard
                : undefined
            }
          >
            {link.name}
          </NavItem>
        ))}
        <NavItem
          key="logout"
          icon={FiLogOut}
          onClick={() => {
            dispatch(logout());
          }}
        >
          Logout
        </NavItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface NavItemProps {
  icon: IconType;
  children: ReactNode;
  onClick: () => void;
  onMouseEnter?: () => void;
  /** Optional count shown as a badge (hidden when 0 or undefined). */
  badge?: number;
}

const NavItem = ({
  icon: IconComponent,
  children,
  onClick,
  onMouseEnter,
  badge,
}: NavItemProps): ReactNode => {
  return (
    <DropdownMenuItem
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="cursor-pointer"
    >
      <IconComponent className="mr-2 size-4" />
      {children}
      {badge != null && badge > 0 ? (
        <Badge className="ml-auto bg-red-500 text-white">{badge}</Badge>
      ) : null}
    </DropdownMenuItem>
  );
};

export default Nav;
