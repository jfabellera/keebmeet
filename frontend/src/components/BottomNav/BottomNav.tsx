import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { FiMoreHorizontal } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { type SidebarItem } from '../Sidebar/Sidebar';

interface BottomNavProps {
  items: SidebarItem[];
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
  className?: string;
}

/**
 * Total slots to show in the bar. When there are more items than slots, the
 * final slot becomes a "More" button that reveals the overflow in a sheet.
 */
const MAX_SLOTS = 5;

/**
 * Mobile bottom navigation. Mirrors the desktop {@link ../Sidebar/Sidebar}
 * using the same items; the active destination is highlighted in the primary
 * color.
 */
const BottomNav = ({
  items,
  value,
  setValue,
  className,
}: BottomNavProps): ReactNode => {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const hasOverflow = items.length > MAX_SLOTS;
  const primaryItems = hasOverflow ? items.slice(0, MAX_SLOTS - 1) : items;
  const overflowItems = hasOverflow ? items.slice(MAX_SLOTS - 1) : [];
  const overflowActive = overflowItems.some((item) => item.value === value);

  const go = (item: SidebarItem): void => {
    setValue(item.value);
    void navigate(item.url);
  };

  if (items.length < 2) return <></>;

  return (
    <nav
      className={cn(
        // Clear the iOS home indicator without reserving its full inset, which
        // would push the buttons too high in the bar.
        'bg-background w-full shrink-0 border-t pt-1 pb-[max(0px,calc(env(safe-area-inset-bottom)-0.75rem))]',
        className
      )}
    >
      <div className="flex h-16 items-stretch">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                go(item);
              }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-transform duration-150 ease-out active:scale-90',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon
                size={20}
                className={cn(
                  'transition-transform duration-200 ease-out',
                  active && '-translate-y-0.5 scale-110'
                )}
              />
              <span className="max-w-full truncate px-1">{item.name}</span>
            </button>
          );
        })}

        {hasOverflow && (
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(true);
              }}
              aria-current={overflowActive ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-transform duration-150 ease-out active:scale-90',
                overflowActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <FiMoreHorizontal
                size={20}
                className={cn(
                  'transition-transform duration-200 ease-out',
                  overflowActive && '-translate-y-0.5 scale-110'
                )}
              />
              <span>More</span>
            </button>
            <SheetContent side="bottom" className="rounded-t-xl">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {overflowItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.value === value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        go(item);
                        setMoreOpen(false);
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm transition-transform duration-150 ease-out active:scale-95',
                        active
                          ? 'border-primary text-primary'
                          : 'text-muted-foreground'
                      )}
                    >
                      <Icon size={22} />
                      <span className="text-center">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
};

export default BottomNav;
