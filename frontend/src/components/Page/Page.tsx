import { Box, Flex, useColorModeValue, useDisclosure } from '@chakra-ui/react';
import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import Navbar from '../Navbar/Navbar';
import Sidebar, { type SidebarItem } from '../Sidebar/Sidebar';

export interface PageProps {
  children: ReactNode;
  sidebarItems?: SidebarItem[];
  sidebarValue?: string;
  setSidebarValue?: Dispatch<SetStateAction<string>>;
}

const Page = ({
  sidebarItems,
  children,
  sidebarValue,
  setSidebarValue,
}: PageProps): ReactNode => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Flex
      direction="column"
      height="100svh"
      bg={useColorModeValue('gray.100', 'gray.900')}
    >
      <Navbar sidebar={sidebarItems != null} onOpen={onOpen} />
      <Box height={'full'} w="auto" overflow="auto">
        {sidebarItems != null &&
        sidebarValue != null &&
        setSidebarValue != null ? (
          <Flex direction={'row'} height={'100%'}>
            <Sidebar
              sidebarItems={sidebarItems}
              isOpen={isOpen}
              onClose={onClose}
              value={sidebarValue}
              setValue={setSidebarValue}
            />
            <Box flexGrow={1}>{children}</Box>
          </Flex>
        ) : (
          children
        )}
      </Box>
    </Flex>
  );
};

export default Page;
