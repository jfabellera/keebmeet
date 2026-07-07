import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import Navbar from '../Navbar/Navbar';
import Sidebar, { type SidebarItem } from '../Sidebar/Sidebar';
import { useDisclosure } from '@/hooks/useDisclosure';

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
    <div className="bg-muted flex h-svh flex-col">
      <Navbar sidebar={sidebarItems != null} onOpen={onOpen} />
      <div className="h-full w-auto overflow-auto">
        {sidebarItems != null &&
        sidebarValue != null &&
        setSidebarValue != null ? (
          <div className="flex h-full flex-row">
            <Sidebar
              sidebarItems={sidebarItems}
              isOpen={isOpen}
              onClose={onClose}
              value={sidebarValue}
              setValue={setSidebarValue}
            />
            <div className="grow">{children}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default Page;
