import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { FiMoon, FiSun } from 'react-icons/fi';

export function ModeToggle(): React.ReactElement {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      }}
    >
      <FiSun className="size-5 dark:hidden" />
      <FiMoon className="hidden size-5 dark:block" />
    </Button>
  );
}
