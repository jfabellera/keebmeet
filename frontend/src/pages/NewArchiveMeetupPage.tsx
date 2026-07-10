import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/hooks';
import { useFormik } from 'formik';
import { type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MeetupImageField from '../components/Meetups/MeetupImageField';
import OrganizerCombobox from '../components/Meetups/OrganizerCombobox';
import Page from '../components/Page/Page';
import { useCreateArchiveMeetupMutation } from '../store/meetupSlice';
import ArchiveMeetupFormSchema from '../util/schemas/ArchiveMeetupFormSchema';

type OrganizerType = 'me' | 'registered' | 'unregistered';

const NewArchiveMeetupPage = (): ReactNode => {
  const [createArchiveMeetup, { isLoading }] =
    useCreateArchiveMeetupMutation();
  const currentUserId = useAppSelector((state) => state.user.user?.id);
  const navigate = useNavigate();
  const formik = useFormik({
    initialValues: {
      name: '',
      date: '',
      address: '',
      imageUrl: '',
      imageKey: '',
      description: '',
      // No default: whoever archives a past meetup often isn't its organizer,
      // so they must consciously pick rather than silently be credited.
      organizerType: '' as OrganizerType | '',
      organizerId: '',
      organizerName: '',
    },
    onSubmit: async (values) => {
      const result = await createArchiveMeetup({
        name: values.name,
        // Archives capture the day only; default to noon so the stored date
        // can't roll to an adjacent day across the UTC offset.
        date: new Date(`${values.date}T12:00Z`).toISOString(),
        address: values.address,
        image_key: values.imageKey,
        description: values.description,
        // The three organizer modes are mutually exclusive; the backend keeps
        // whichever identifies a lead and drops a redundant name.
        is_organizer: values.organizerType === 'me',
        organizer_id:
          values.organizerType === 'registered'
            ? values.organizerId
            : undefined,
        organizer_name:
          values.organizerType === 'unregistered'
            ? values.organizerName
            : undefined,
      });

      if ('error' in result && result.error != null && 'data' in result.error) {
        const data: any = result.error.data;
        toast.error('Error archiving meetup', {
          description: data.message,
        });
      } else {
        void navigate('/organizer');
      }
    },
    validationSchema: ArchiveMeetupFormSchema,
    validateOnMount: true,
  });

  const onDescriptionChange = (
    event: ChangeEvent<HTMLTextAreaElement>
  ): void => {
    // Truncate more than 500 characters
    event.target.value = event.target.value.substring(0, 500);
    formik.handleChange(event);
  };

  return (
    <Page>
      <div className="mx-auto max-w-3xl p-4">
        <div className="mx-auto flex max-w-lg flex-col gap-4">
          <h1 className="text-center text-4xl font-bold">
            Archive a Past Meetup
          </h1>
          <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="organizerType">Organizer</FieldLabel>
                  <Select
                    value={formik.values.organizerType}
                    onValueChange={(value) => {
                      void formik.setFieldValue('organizerType', value);
                      // Clear the fields for the modes we're leaving so a stale
                      // value can't linger behind the form.
                      void formik.setFieldValue('organizerId', '');
                      void formik.setFieldValue('organizerName', '');
                    }}
                  >
                    <SelectTrigger id="organizerType" className="w-full">
                      <SelectValue placeholder="Select who organized this meetup" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">I organized this meetup</SelectItem>
                      <SelectItem value="registered">
                        A registered organizer
                      </SelectItem>
                      <SelectItem value="unregistered">
                        Someone without an account
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {formik.values.organizerType === 'registered' && (
                  <Field>
                    <FieldLabel htmlFor="organizer">
                      Registered Organizer
                    </FieldLabel>
                    <OrganizerCombobox
                      id="organizer"
                      // Single-select: keep only the most recently chosen id.
                      value={
                        formik.values.organizerId
                          ? [formik.values.organizerId]
                          : []
                      }
                      onChange={(organizerIds) =>
                        void formik.setFieldValue(
                          'organizerId',
                          organizerIds.at(-1) ?? ''
                        )
                      }
                      excludeIds={currentUserId ? [currentUserId] : []}
                    />
                  </Field>
                )}

                {formik.values.organizerType === 'unregistered' && (
                  <FormField
                    formik={formik}
                    name="organizerName"
                    label="Organizer Name"
                  />
                )}

                <FormField formik={formik} name="name" label="Meetup Name" />

                <FormField
                  formik={formik}
                  name="date"
                  label="Date"
                  type="date"
                />

                <FormField formik={formik} name="address" label="Address" />

                <MeetupImageField
                  previewUrl={formik.values.imageUrl}
                  onUploaded={(imageKey, imageUrl) => {
                    void formik.setFieldValue('imageKey', imageKey);
                    void formik.setFieldValue('imageUrl', imageUrl);
                  }}
                />

                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    name="description"
                    onChange={onDescriptionChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.description}
                  />
                  <p
                    className={cn(
                      'mt-1 text-right text-sm',
                      formik.values.description.length === 500
                        ? 'text-destructive'
                        : 'text-foreground'
                    )}
                  >
                    {formik.values.description.length} / 500
                  </p>
                </Field>

                <Button
                  type="submit"
                  disabled={!formik.isValid || isLoading}
                  size="lg"
                >
                  Archive
                  {isLoading && <Spinner />}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default NewArchiveMeetupPage;
