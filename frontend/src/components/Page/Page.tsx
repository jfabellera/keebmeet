import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';
import BottomNav from '../BottomNav/BottomNav';
import Navbar from '../Navbar/Navbar';
import Sidebar, {
  type SidebarBackLink,
  type SidebarItem,
} from '../Sidebar/Sidebar';

export interface PageProps {
  children: ReactNode;
  sidebarItems?: SidebarItem[];
  sidebarValue?: string;
  setSidebarValue?: Dispatch<SetStateAction<string>>;
  /** Optional link shown atop the sidebar for returning to a parent view. */
  sidebarBackTo?: SidebarBackLink;
}

const Page = ({
  sidebarItems,
  children,
  sidebarValue,
  setSidebarValue,
  sidebarBackTo,
}: PageProps): ReactNode => {
  const hasSidebar =
    sidebarItems != null && sidebarValue != null && setSidebarValue != null;

  const scrollRef = useScrollRestoration<HTMLDivElement>();

  return (
    <div className="bg-muted flex h-svh flex-col">
      <Navbar />
      {hasSidebar ? (
        <>
          {/* Desktop: navigation rail beside the content. */}
          <SidebarProvider className="min-h-0 flex-1">
            <Sidebar
              sidebarItems={sidebarItems}
              value={sidebarValue}
              setValue={setSidebarValue}
              backTo={sidebarBackTo}
            />
            <SidebarInset
              ref={scrollRef}
              className="min-h-0 overflow-auto bg-transparent"
            >
              {children}
            </SidebarInset>
          </SidebarProvider>
          {/* Mobile: bottom navigation takes over for the sidebar. */}
          <BottomNav
            items={sidebarItems}
            value={sidebarValue}
            setValue={setSidebarValue}
            className="md:hidden"
          />
        </>
      ) : (
        <div className="h-full w-auto overflow-hidden">
          <div ref={scrollRef} className="relative h-full overflow-auto">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;
