import { type ReactNode } from 'react';
import ImageUploadField from '../shared/ImageUploadField';
import { useMeetupImageUpload } from './useMeetupImageUpload';

interface Props {
  previewUrl: string;
  onUploaded: (imageKey: string, imageUrl: string) => void;
  onRemove?: () => void;
  editable?: boolean;
  label?: string;
}

/** Meetup image picker — a 2:1 banner wired to the meetup upload endpoint. */
const MeetupImageField = ({
  label = 'Meetup Image',
  ...props
}: Props): ReactNode => (
  <ImageUploadField
    {...props}
    label={label}
    useUpload={useMeetupImageUpload}
  />
);

export default MeetupImageField;
