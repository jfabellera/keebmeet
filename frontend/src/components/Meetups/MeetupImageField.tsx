import { type ReactNode } from 'react';
import { useUploadMeetupImageMutation } from '../../store/meetupSlice';
import ImageUploadField from '../shared/ImageUploadField';

interface Props {
  previewUrl: string;
  onUploaded: (imageKey: string, imageUrl: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
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
    useUploadMutation={useUploadMeetupImageMutation}
  />
);

export default MeetupImageField;
