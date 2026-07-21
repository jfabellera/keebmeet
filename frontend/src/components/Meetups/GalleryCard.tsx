import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { type GalleryPreview } from '@keebmeet/shared';
import { type ReactNode } from 'react';

/** Best-effort hostname for the tile caption; falls back to the raw link. */
export const linkLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

interface GalleryCardProps {
  gallery: string;
  preview: GalleryPreview | undefined;
  subtitle?: ReactNode;
  /** Trailing controls beside the caption, e.g. a moderation menu. */
  actions?: ReactNode;
}

export const GalleryCard = ({
  gallery,
  preview,
  subtitle,
  actions,
}: GalleryCardProps): ReactNode => {
  const title = preview?.title ?? preview?.siteName ?? linkLabel(gallery);

  return (
    <div className="overflow-hidden rounded-md border">
      <a href={gallery} target="_blank" rel="noopener noreferrer">
        <AspectRatio ratio={1}>
          <ImageWithFallback
            src={preview?.image ?? gallery}
            resizeWidth={256}
            className="size-full object-cover"
          />
        </AspectRatio>
      </a>
      <div className="flex items-start gap-1 p-2 text-xs">
        <a
          href={gallery}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1"
        >
          <p className="truncate font-medium">{title}</p>
          {subtitle != null ? (
            <p className="text-muted-foreground truncate">{subtitle}</p>
          ) : null}
        </a>
        {actions}
      </div>
    </div>
  );
};
