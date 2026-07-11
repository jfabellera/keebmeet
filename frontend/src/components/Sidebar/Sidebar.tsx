import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as SidebarPrimitive,
} from '@/components/ui/sidebar';
import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { type IconType } from 'react-icons';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

export interface SidebarItem {
  name: string;
  value: string;
  icon: IconType;
  url: string;
}

export interface SidebarBackLink {
  label: string;
  url: string;
}

interface SidebarProps {
  sidebarItems: SidebarItem[];
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
  /** Optional link rendered above the nav for returning to a parent view. */
  backTo?: SidebarBackLink;
}

/**
 * Desktop navigation rail built on shadcn's sidebar primitives. Hidden on
 * mobile, where {@link ../BottomNav/BottomNav BottomNav} takes over instead.
 */
const Sidebar = ({
  sidebarItems,
  value,
  setValue,
  backTo,
}: SidebarProps): ReactNode => {
  const navigate = useNavigate();

  return (
    <SidebarPrimitive
      collapsible="none"
      className="hidden h-full border-r md:flex"
    >
      {backTo != null ? (
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-muted-foreground"
                onClick={() => {
                  void navigate(backTo.url);
                }}
              >
                <FiArrowLeft />
                <span>{backTo.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      ) : null}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      isActive={item.value === value}
                      onClick={() => {
                        setValue(item.value);
                        void navigate(item.url, { replace: true });
                      }}
                      className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary data-[active=true]:hover:text-primary-foreground"
                    >
                      <Icon />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarPrimitive>
  );
};

export default Sidebar;
