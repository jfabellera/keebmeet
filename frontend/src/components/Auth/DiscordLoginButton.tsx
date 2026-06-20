import { Button } from '@/components/ui/button';
import { type ReactNode } from 'react';
import { FaDiscord } from 'react-icons/fa';
import { redirectToDiscordLogin } from '../../util/discord';

/**
 * "Continue with Discord" SSO button, preceded by an "or" divider. Redirects the
 * browser into the Discord OAuth2 flow.
 */
export const DiscordLoginButton = (): ReactNode => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <span className="bg-border h-px flex-1" />
      </div>
      <Button
        type="button"
        className="bg-[#5865F2] text-white hover:bg-[#4752c4]"
        onClick={redirectToDiscordLogin}
      >
        <FaDiscord />
        Continue with Discord
      </Button>
    </div>
  );
};
