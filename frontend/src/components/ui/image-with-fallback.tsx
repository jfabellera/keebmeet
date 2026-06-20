import { useState, type ReactNode } from 'react';

interface ImageWithFallbackProps extends React.ComponentProps<'img'> {
  fallback?: ReactNode;
}

/**
 * Native <img> that renders `fallback` when no source is provided or the image
 * fails to load. Replaces Chakra's <Image fallback={...} />.
 */
export function ImageWithFallback({
  src,
  fallback,
  alt = '',
  ...props
}: ImageWithFallbackProps): ReactNode {
  const [errored, setErrored] = useState(false);

  if ((src == null || src === '' || errored) && fallback != null) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => {
        setErrored(true);
      }}
      {...props}
    />
  );
}
