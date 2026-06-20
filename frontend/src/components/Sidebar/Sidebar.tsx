import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { type IconType } from 'react-icons';
import { useNavigate } from 'react-router-dom';

/**
 * Adapted from https://chakra-templates.vercel.app/navigation/sidebar
 */

export interface SidebarItem {
  name: string;
  value: string;
  icon: IconType;
  url: string;
}

interface SidebarProps {
  sidebarItems: SidebarItem[];
  isOpen: boolean;
  onClose: () => void;
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
}

const Sidebar = ({
  sidebarItems,
  isOpen,
  onClose,
  value,
  setValue,
}: SidebarProps): ReactNode => {
  return (
    <div className="bg-muted h-full">
      <SidebarContent
        sidebarItems={sidebarItems}
        onClose={onClose}
        className="hidden md:block"
        value={value}
        setValue={setValue}
      />
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent side="left" className="w-60 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent
            sidebarItems={sidebarItems}
            onClose={onClose}
            value={value}
            setValue={setValue}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};

interface SidebarContentProps extends React.ComponentProps<'div'> {
  sidebarItems: SidebarItem[];
  onClose: () => void;
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
}

const SidebarContent = ({
  sidebarItems,
  onClose,
  value,
  setValue,
  className,
  ...rest
}: SidebarContentProps): ReactNode => {
  const navigate = useNavigate();

  return (
    <div
      className={cn('bg-background h-full w-full border-r md:w-60', className)}
      {...rest}
    >
      {sidebarItems.map((link) => (
        <NavItem
          key={link.value}
          icon={link.icon}
          selected={link.value === value}
          onClick={() => {
            setValue(link.value);
            void navigate(link.url);
            onClose();
          }}
        >
          {link.name}
        </NavItem>
      ))}
    </div>
  );
};

interface NavItemProps {
  icon: IconType;
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
}

const NavItem = ({
  icon: IconComponent,
  children,
  selected,
  onClick,
}: NavItemProps): ReactNode => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-4 p-4 hover:bg-accent hover:text-accent-foreground',
        selected ? 'bg-primary text-primary-foreground' : ''
      )}
    >
      {IconComponent != null && <IconComponent className="size-4" />}
      {children}
    </div>
  );
};

export default Sidebar;
