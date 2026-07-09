import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { type IconType } from 'react-icons';
import { useNavigate } from 'react-router-dom';

export interface SidebarItem {
  name: string;
  value: string;
  icon: IconType;
  url: string;
}

interface SidebarProps {
  sidebarItems: SidebarItem[];
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
}

/**
 * Desktop navigation rail built on shadcn's sidebar primitives. Hidden on
 * mobile, where {@link ../BottomNav/BottomNav BottomNav} takes over instead.
 */
const Sidebar = ({
  sidebarItems,
  value,
  setValue,
}: SidebarProps): ReactNode => {
  const navigate = useNavigate();

  return (
    <SidebarPrimitive
      collapsible="none"
      className="hidden h-full border-r md:flex"
    >
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
                        void navigate(item.url);
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
