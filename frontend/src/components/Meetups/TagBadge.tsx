import { Badge } from '@/components/ui/badge';
import { type TagInfo } from '@keebmeet/shared';
import { type ReactNode } from 'react';

export const TagBadge = ({ tag }: { tag: TagInfo }): ReactNode => (
  <Badge variant="secondary">
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: tag.color }}
    />
    {tag.name}
  </Badge>
);
