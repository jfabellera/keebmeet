import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useFormik } from 'formik';
import { type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Page from '../components/Page/Page';
import { useCreateMeetupMutation } from '../store/meetupSlice';
import MeetupFormSchema from '../util/schemas/MeetupFormSchema';

const NewMeetupPage = (): ReactNode => {
  const [createMeetup] = useCreateMeetupMutation();
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
      description: '',
      hasRaffle: true,
      defaultRaffleEntries: 1,
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
        image_url: formik.values.imageUrl,
        description: formik.values.description,
        has_raffle: formik.values.hasRaffle,
        default_raffle_entries: formik.values.hasRaffle
          ? formik.values.defaultRaffleEntries
          : formik.initialValues.defaultRaffleEntries,
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
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="name">Meetup Name</Label>
                  <Input
                    id="name"
                    type="text"
                    name="name"
                    aria-invalid={
                      formik.errors.name != null && formik.touched.name
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <FieldError
                    show={formik.errors.name != null && formik.touched.name}
                  >
                    {formik.errors.name}
                  </FieldError>
                </div>

                <div className="flex gap-2">
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      name="date"
                      aria-invalid={
                        formik.errors.date != null && formik.touched.date
                      }
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <FieldError
                      show={formik.errors.date != null && formik.touched.date}
                    >
                      {formik.errors.date}
                    </FieldError>
                  </div>

                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      name="startTime"
                      aria-invalid={
                        formik.errors.startTime != null &&
                        formik.touched.startTime
                      }
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <FieldError
                      show={
                        formik.errors.startTime != null &&
                        formik.touched.startTime
                      }
                    >
                      {formik.errors.startTime}
                    </FieldError>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <Label htmlFor="duration">Duration (hours)</Label>
                    <Input
                      id="duration"
                      type="number"
                      name="duration"
                      aria-invalid={
                        formik.errors.duration != null &&
                        formik.touched.duration
                      }
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <FieldError
                      show={
                        formik.errors.duration != null &&
                        formik.touched.duration
                      }
                    >
                      {formik.errors.duration}
                    </FieldError>
                  </div>

                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      name="capacity"
                      aria-invalid={
                        formik.errors.capacity != null &&
                        formik.touched.capacity
                      }
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <FieldError
                      show={
                        formik.errors.capacity != null &&
                        formik.touched.capacity
                      }
                    >
                      {formik.errors.capacity}
                    </FieldError>
                  </div>
                </div>

                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    type="text"
                    name="address"
                    aria-invalid={
                      formik.errors.address != null && formik.touched.address
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <FieldError
                    show={
                      formik.errors.address != null && formik.touched.address
                    }
                  >
                    {formik.errors.address}
                  </FieldError>
                </div>

                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    type="text"
                    name="imageUrl"
                    aria-invalid={
                      formik.errors.imageUrl != null && formik.touched.imageUrl
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <FieldError
                    show={
                      formik.errors.imageUrl != null && formik.touched.imageUrl
                    }
                  >
                    {formik.errors.imageUrl}
                  </FieldError>
                </div>

                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="description">Description</Label>
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
                </div>

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

                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="defaultRaffleEntries">
                    Default raffle entries per attendee
                  </Label>
                  <Input
                    id="defaultRaffleEntries"
                    type="number"
                    name="defaultRaffleEntries"
                    disabled={!formik.values.hasRaffle}
                    aria-invalid={
                      formik.errors.defaultRaffleEntries != null &&
                      formik.touched.defaultRaffleEntries
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.defaultRaffleEntries}
                  />
                  <FieldError
                    show={
                      formik.errors.defaultRaffleEntries != null &&
                      formik.touched.defaultRaffleEntries
                    }
                  >
                    {formik.errors.defaultRaffleEntries}
                  </FieldError>
                </div>

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
