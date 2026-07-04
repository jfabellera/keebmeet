import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
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
import { useCreateMeetupMutation } from '../store/meetupSlice';
import MeetupFormSchema from '../util/schemas/MeetupFormSchema';

const NewMeetupPage = (): ReactNode => {
  const [createMeetup] = useCreateMeetupMutation();
  const currentUserId = useAppSelector((state) => state.user.user?.id);
  const navigate = useNavigate();
  const formik = useFormik({
    initialValues: {
      name: '',
      date: '',
      startTime: '',
      address: '',
      duration: 0,
      capacity: 0,
      imageUrl: '',
      imageKey: '',
      description: '',
      hasRaffle: true,
      defaultRaffleEntries: 1,
      organizerIds: [] as number[],
    },
    onSubmit: async (values) => {
      const result = await createMeetup({
        name: formik.values.name,
        date: new Date(
          `${formik.values.date}T${formik.values.startTime}Z`
        ).toISOString(),
        address: formik.values.address,
        duration_hours: formik.values.duration,
        capacity: formik.values.capacity,
        image_key: formik.values.imageKey,
        description: formik.values.description,
        has_raffle: formik.values.hasRaffle,
        default_raffle_entries: formik.values.hasRaffle
          ? formik.values.defaultRaffleEntries
          : formik.initialValues.defaultRaffleEntries,
        organizer_ids: formik.values.organizerIds,
      });

      if ('error' in result && result.error != null && 'data' in result.error) {
        // is this allowed
        const data: any = result.error.data;
        toast.error('Error creating meetup', {
          description: data.message,
        });
      } else {
        void navigate('/organizer');
      }
    },
    validationSchema: MeetupFormSchema,
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
          <h1 className="text-center text-4xl font-bold">New Meetup</h1>
          <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="flex flex-col gap-4">
                <span
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer self-end underline"
                  onClick={() => {
                    void navigate('/new-meetup/eventbrite');
                  }}
                >
                  Use Eventbrite
                </span>
                <FormField formik={formik} name="name" label="Meetup Name" />

                <div className="flex gap-2">
                  <FormField
                    formik={formik}
                    name="date"
                    label="Date"
                    type="date"
                    className="flex-1"
                  />
                  <FormField
                    formik={formik}
                    name="startTime"
                    label="Start Time"
                    type="time"
                    className="flex-1"
                  />
                </div>

                <div className="flex gap-2">
                  <FormField
                    formik={formik}
                    name="duration"
                    label="Duration (hours)"
                    type="number"
                    className="flex-1"
                  />
                  <FormField
                    formik={formik}
                    name="capacity"
                    label="Capacity"
                    type="number"
                    className="flex-1"
                  />
                </div>

                <FormField formik={formik} name="address" label="Address" />

                <Field>
                  <FieldLabel htmlFor="organizers">
                    Additional Organizers
                  </FieldLabel>
                  <OrganizerCombobox
                    id="organizers"
                    value={formik.values.organizerIds}
                    onChange={(organizerIds) =>
                      void formik.setFieldValue('organizerIds', organizerIds)
                    }
                    excludeIds={currentUserId ? [currentUserId] : []}
                  />
                </Field>

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

                <div className="flex items-center gap-2">
                  <Label htmlFor="hasRaffle" className="pr-4">
                    Will this meetup have raffles?
                  </Label>
                  <Checkbox
                    id="hasRaffle"
                    name="hasRaffle"
                    checked={formik.values.hasRaffle}
                    onCheckedChange={(checked) => {
                      void formik.setFieldValue('hasRaffle', checked === true);
                    }}
                  />
                  <span>Yes</span>
                </div>

                <FormField
                  formik={formik}
                  name="defaultRaffleEntries"
                  label="Default raffle entries per attendee"
                  type="number"
                  disabled={!formik.values.hasRaffle}
                  value={formik.values.defaultRaffleEntries}
                />

                <Button type="submit" disabled={!formik.isValid} size="lg">
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default NewMeetupPage;
