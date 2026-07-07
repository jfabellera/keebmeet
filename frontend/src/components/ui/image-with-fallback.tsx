import { useEffect, useState, type ReactNode } from 'react';
import { FiImage } from 'react-icons/fi';
import { resizedImageUrl } from '../../util/imageUrl';

interface ImageWithFallbackProps extends React.ComponentProps<'img'> {
  fallback?: ReactNode;
  resizeWidth?: number;
}

/**
 * Native <img> that renders `fallback` when no source is provided or the image
 * fails to load. Replaces Chakra's <Image fallback={...} />.
 */
export function ImageWithFallback({
  src,
  fallback,
  alt = '',
  resizeWidth,
  ...props
}: ImageWithFallbackProps): ReactNode {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (src == null || src === '' || errored) {
    return (
      <>
        {fallback ?? (
          <div className="bg-primary-foreground flex size-full items-center justify-center">
            <FiImage className="size-8" />
          </div>
        )}
      </>
    );
  }

  return (
    <img
      src={
        resizeWidth != null ? resizedImageUrl(src, { width: resizeWidth }) : src
      }
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        setErrored(true);
      }}
      {...props}
    />
  );
}
