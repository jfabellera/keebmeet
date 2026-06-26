import { Button } from '@/components/ui/button';
import { type ReactNode } from 'react';
import { FaDiscord } from 'react-icons/fa';
import { redirectToDiscordLink } from '../../util/discord';

const DiscordLinkButton = (): ReactNode => {
  return (
    <Button
      className="bg-[#5865F2] text-white hover:bg-[#4752c4]"
      onClick={redirectToDiscordLink}
    >
      <FaDiscord />
      Link Discord
    </Button>
  );
};

export default DiscordLinkButton;
