import { ModeToggle } from '@/components/mode-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type ReactNode } from 'react';
import { type IconType } from 'react-icons';
import { FiLogOut, FiMenu, FiUser } from 'react-icons/fi';
import { MdDashboardCustomize } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../store/authSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

/**
 * Adapted from https://chakra-templates.dev/navigation/navbar
 */

interface LinkItemProps {
  name: string;
  url: string;
  icon: IconType;
  organizerOnly?: boolean;
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
    <div className="flex h-16 w-full items-center gap-1 border-b bg-background px-4">
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
        className="cursor-pointer"
        onClick={() => {
          void navigate('/');
        }}
      >
        Meetup Management System
      </span>
      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
        {isLoggedIn && user != null ? (
          <NavbarDropdown
            nickname={user.displayName}
            isOrganizer={user.isOrganizer}
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
    <div className="flex flex-row items-center justify-end gap-6">
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
        className="hidden bg-pink-400 font-semibold text-white hover:bg-pink-300 md:inline-flex"
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
  nickname: string;
  isOrganizer: boolean;
}

const NavbarDropdown = ({
  nickname,
  isOrganizer,
}: NavbarDropdownProps): ReactNode => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const avatarSrc = 'https://avatars.dicebear.com/api/male/username.svg';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full" aria-label="account menu">
          <Avatar className="size-8">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback>
              <FiUser />
            </AvatarFallback>
          </Avatar>
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
        {LinkItems.map((link) =>
          link.organizerOnly == null || (link.organizerOnly && isOrganizer) ? (
            <NavItem
              key={link.name}
              icon={link.icon}
              onClick={() => {
                void navigate(link.url);
              }}
            >
              {link.name}
            </NavItem>
          ) : null
        )}
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
}

const NavItem = ({
  icon: IconComponent,
  children,
  onClick,
}: NavItemProps): ReactNode => {
  return (
    <DropdownMenuItem onClick={onClick} className="cursor-pointer">
      <IconComponent className="mr-2 size-4" />
      {children}
    </DropdownMenuItem>
  );
};

export default Nav;
