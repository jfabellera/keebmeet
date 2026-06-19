import {
  Avatar,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Icon,
  IconButton,
  Link,
  Menu,
  MenuButton,
  MenuDivider,
  MenuList,
  Show,
  Spacer,
  Stack,
  useColorModeValue,
  type BoxProps,
  type FlexProps,
} from '@chakra-ui/react';
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
    <>
      <Flex
        px={4}
        h={16}
        w="full"
        alignItems={'center'}
        justifyContent={'space-between'}
        bg={useColorModeValue('white', 'gray.900')}
        borderBottom="1px"
        borderBottomColor={useColorModeValue('gray.200', 'gray.700')}
      >
        <HStack flexGrow={1} gap={1}>
          {sidebar != null && sidebar ? (
            <Show below={'md'}>
              <IconButton
                icon={<FiMenu />}
                variant={'outline'}
                marginRight={'0.5rem'}
                onClick={onOpen}
                aria-label={'menu'}
              />
            </Show>
          ) : null}
          <Link
            onClick={() => {
              navigate('/');
            }}
          >
            <Box>Meetup Management System</Box>
          </Link>
          <Spacer />
          {isLoggedIn && user != null ? (
            <NavbarDropdown
              nickname={user.displayName}
              isOrganizer={user.isOrganizer}
            />
          ) : (
            <GuestButtons />
          )}
        </HStack>
      </Flex>
    </>
  );
};

/**
 * Sign in and sign up buttons for when a user is not logged in.
 */
const GuestButtons = (): ReactNode => {
  const navigate = useNavigate();
  return (
    <Stack
      flex={{ base: 1, md: 0 }}
      justify={'flex-end'}
      direction={'row'}
      spacing={6}
    >
      <Button
        as={'a'}
        fontSize={'sm'}
        fontWeight={400}
        variant={'link'}
        onClick={() => {
          navigate('/login');
        }}
      >
        Sign In
      </Button>
      <Button
        as={'a'}
        display={{ base: 'none', md: 'inline-flex' }}
        fontSize={'sm'}
        fontWeight={600}
        color={'white'}
        bg={'pink.400'}
        onClick={() => {
          navigate('/register');
        }}
        _hover={{
          bg: 'pink.300',
        }}
      >
        Sign Up
      </Button>
    </Stack>
  );
};

interface NavbarDropdownProps extends BoxProps {
  nickname: string;
  isOrganizer: boolean;
}

const NavbarDropdown = (props: NavbarDropdownProps): ReactNode => {
  const { nickname, isOrganizer } = props;
  const dispatch = useAppDispatch();

  return (
    <Flex alignItems={'center'}>
      <Stack direction={'row'} spacing={7}>
        <Menu>
          <MenuButton
            as={Button}
            rounded={'full'}
            variant={'link'}
            cursor={'pointer'}
            minW={0}
          >
            <Avatar
              size={'sm'}
              src={'https://avatars.dicebear.com/api/male/username.svg'}
            />
          </MenuButton>
          <MenuList alignItems={'center'}>
            <br />
            <Center>
              <Avatar
                size={'2xl'}
                src={'https://avatars.dicebear.com/api/male/username.svg'}
              />
            </Center>
            <br />
            <Center>
              <p>{nickname}</p>
            </Center>
            <br />
            <MenuDivider />
            {LinkItems.map((link) =>
              link.organizerOnly == null ||
              (link.organizerOnly && isOrganizer) ? (
                <NavItem key={link.name} icon={link.icon} url={link.url}>
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
              url=""
            >
              Logout
            </NavItem>
          </MenuList>
        </Menu>
      </Stack>
    </Flex>
  );
};

interface NavItemProps extends FlexProps {
  icon: IconType;
  url: string;
  children: ReactNode;
}

const NavItem = ({
  icon,
  url,
  children,
  ...rest
}: NavItemProps): ReactNode => {
  const navigate = useNavigate();
  return (
    <Link
      onClick={() => {
        navigate(url);
      }}
      style={{ textDecoration: 'none' }}
      _focus={{ boxShadow: 'none' }}
    >
      <Flex
        align="center"
        p="4"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        _hover={{
          bg: 'cyan.400',
          color: 'white',
        }}
        {...rest}
      >
        <Icon
          mr="4"
          fontSize="16"
          _groupHover={{
            color: 'white',
          }}
          as={icon}
        />
        {children}
      </Flex>
    </Link>
  );
};

export default Nav;
