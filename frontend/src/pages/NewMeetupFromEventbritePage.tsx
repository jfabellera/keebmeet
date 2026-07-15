import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useFormik } from 'formik';
import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type EventbriteEvent,
  type EventbriteOrganization,
  type EventbriteQuestion,
  type EventbriteTicket,
} from '@keebmeet/shared';
import Page from '../components/Page/Page';
import BackButton from '../components/shared/BackButton';
import {
  useGetCustomQuestionsQuery,
  useGetEventsQuery,
  useGetOrganizationsQuery,
  useGetTicketClassesQuery,
} from '../store/eventbriteSlice';
import { useAppSelector } from '../store/hooks';
import { useCreateMeetupFromEventbriteMutation } from '../store/meetupSlice';
import { useGetUserQuery } from '../store/userSlice';
import MeetupFromEventbriteFormSchema from '../util/schemas/MeetupFromEventbriteFormSchema';

const NewMeetupFromEventbritePage = (): ReactNode => {
  const navigate = useNavigate();
  const { user: localUser } = useAppSelector((state) => state.user);
  const { data: user } = useGetUserQuery(localUser?.id ?? '', {
    skip: localUser == null,
  });
  const isEventbriteLinked = user?.is_eventbrite_linked === true;
  const formik = useFormik({
    initialValues: {
      organizationId: '',
      eventId: '',
      ticketClassId: '',
      customQuestionId: '',
      hasRaffle: true,
      defaultRaffleEntries: 1,
    },
    onSubmit: async (values) => {
      if (
        values.eventId === '' ||
        values.ticketClassId === '' ||
        values.customQuestionId === ''
      ) {
        console.log('invalid');
        return;
      }

      const response = await createMeetupFromEventbrite({
        eventbrite_event_id: values.eventId,
        eventbrite_ticket_id: values.ticketClassId,
        eventbrite_question_id: values.customQuestionId,
        has_raffle: values.hasRaffle,
        default_raffle_entries: values.hasRaffle
          ? values.defaultRaffleEntries
          : formik.initialValues.defaultRaffleEntries,
      });

      if ('error' in response) {
        const data =
          response.error != null && 'data' in response.error
            ? (response.error.data as { message?: string } | undefined)
            : undefined;
        toast.error('Error', {
          description: data?.message ?? 'Unable to create meetup',
        });
      } else {
        toast.success('Success', {
          description: 'Meetup created successfully',
        });
        void navigate('/organizer');
      }
    },
    validationSchema: MeetupFromEventbriteFormSchema,
    validateOnMount: true,
  });

  const { data: organizations } = useGetOrganizationsQuery(undefined, {
    skip: !isEventbriteLinked,
  });
  const { data: events } = useGetEventsQuery(formik.values.organizationId, {
    skip: formik.values.organizationId === '',
  });
  const { data: ticketClasses } = useGetTicketClassesQuery(
    formik.values.eventId,
    {
      skip: formik.values.eventId === '',
    }
  );
  const { data: customQuestions } = useGetCustomQuestionsQuery(
    formik.values.eventId,
    {
      skip: formik.values.eventId === '',
    }
  );
  const [createMeetupFromEventbrite, { isLoading }] =
    useCreateMeetupFromEventbriteMutation();

  interface FormSelectProps {
    name: string;
    id: string;
    options:
      | EventbriteOrganization[]
      | EventbriteEvent[]
      | EventbriteTicket[]
      | EventbriteQuestion[]
      | undefined;
    value: string;
    disabled?: boolean;
  }

  const FormSelect = ({
    name,
    id,
    options,
    value,
    disabled,
  }: FormSelectProps): ReactNode => {
    return (
      <Field className="w-full">
        <FieldLabel htmlFor={id}>{name}</FieldLabel>
        <Select
          value={value}
          onValueChange={(selected) => {
            void formik.setFieldValue(id, selected);
          }}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {options != null
              ? options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))
              : null}
          </SelectContent>
        </Select>
      </Field>
    );
  };

  return (
    <Page>
      <div className="mx-2 mt-4 flex flex-col items-center gap-4">
        <div className="relative flex w-full max-w-md items-center justify-center">
          <BackButton
            to="/organizer"
            label="Back to organizer dashboard"
            className="absolute left-0"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold">New Meetup</h1>
            <p>From Eventbrite Event</p>
          </div>
        </div>
        <div className="bg-card text-card-foreground w-full max-w-md rounded-lg p-8 shadow-lg">
          <form onSubmit={formik.handleSubmit} noValidate>
            <div className="flex flex-col items-center gap-4">
              <span
                role="button"
                tabIndex={0}
                className="cursor-pointer self-end underline"
                onClick={() => {
                  void navigate('/new-meetup');
                }}
              >
                Use native
              </span>
              {!isEventbriteLinked ? (
                <p>
                  Please connect your Eventbrite account in your{' '}
                  <Link to="/account" className="text-primary underline">
                    account settings
                  </Link>{' '}
                  to create a meetup from an Eventbrite event.
                </p>
              ) : (
                <>
                  <FormSelect
                    name={'Organization'}
                    id={'organizationId'}
                    options={organizations}
                    value={formik.values.organizationId}
                  />
                  <FormSelect
                    name={'Event'}
                    id={'eventId'}
                    options={events}
                    value={formik.values.eventId}
                    disabled={events == null}
                  />
                  <FormSelect
                    name={'Ticket Class'}
                    id={'ticketClassId'}
                    options={ticketClasses}
                    value={formik.values.ticketClassId}
                    disabled={ticketClasses == null}
                  />
                  <FormSelect
                    name={'Custom Question'}
                    id={'customQuestionId'}
                    options={customQuestions}
                    value={formik.values.customQuestionId}
                    disabled={customQuestions == null}
                  />

                  <div className="flex w-full items-center gap-2">
                    <Label htmlFor="hasRaffle" className="pr-4">
                      Will this meetup have raffles?
                    </Label>
                    <Checkbox
                      id="hasRaffle"
                      name="hasRaffle"
                      checked={formik.values.hasRaffle}
                      onCheckedChange={(checked) => {
                        void formik.setFieldValue(
                          'hasRaffle',
                          checked === true
                        );
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
                    className="w-full"
                  />
                  <Button
                    type={'submit'}
                    disabled={!formik.isValid || isLoading}
                  >
                    Submit
                    {isLoading && <Spinner />}
                  </Button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </Page>
  );
};

export default NewMeetupFromEventbritePage;
