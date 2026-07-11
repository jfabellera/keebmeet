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
import { useFormik } from 'formik';
import { type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MeetupImageField from '../components/Meetups/MeetupImageField';
import Page from '../components/Page/Page';
import BackButton from '../components/shared/BackButton';
import { useCreateArchiveMeetupMutation } from '../store/meetupSlice';
import ArchiveMeetupFormSchema from '../util/schemas/ArchiveMeetupFormSchema';

const NewArchiveMeetupPage = (): ReactNode => {
  const [createArchiveMeetup, { isLoading }] = useCreateArchiveMeetupMutation();
  const navigate = useNavigate();
  const formik = useFormik({
    initialValues: {
      name: '',
      date: '',
      address: '',
      imageUrl: '',
      imageKey: '',
      description: '',
      // No default so crediting is a deliberate choice; 'other' reveals a
      // required organizer-name field (see the schema).
      organizerType: '' as 'me' | 'other' | '',
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
        // The submitter always owns the archive. The credit is either
        // themselves ('me') or the typed name ('other').
        organizer_name:
          values.organizerType === 'other' ? values.organizerName : undefined,
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
          <div className="relative flex items-center justify-center">
            <BackButton
              to="/organizer"
              label="Back to organizer dashboard"
              className="absolute left-0"
            />
            <h1 className="text-center text-4xl font-bold">
              Archive a Past Meetup
            </h1>
          </div>
          <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="organizerType">Organizer</FieldLabel>
                  <Select
                    value={formik.values.organizerType}
                    onValueChange={(value) => {
                      void formik.setFieldValue('organizerType', value);
                      // Clear a stale name when switching back to self-credit.
                      if (value === 'me') {
                        void formik.setFieldValue('organizerName', '');
                      }
                    }}
                  >
                    <SelectTrigger id="organizerType" className="w-full">
                      <SelectValue placeholder="Who organized this meetup?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">I organized this</SelectItem>
                      <SelectItem value="other">
                        Someone else organized this
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {formik.values.organizerType === 'other' && (
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
