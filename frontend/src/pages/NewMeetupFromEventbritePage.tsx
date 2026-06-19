import { type ReactNode } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Link,
  Select,
  Stack,
  Text,
  useToast,
  VStack,
  type SelectProps,
} from '@chakra-ui/react';
import { useFormik } from 'formik';
import { useNavigate } from 'react-router-dom';
import {
  type EventbriteEvent,
  type EventbriteOrganization,
  type EventbriteQuestion,
  type EventbriteTicket,
} from '../../../backend/src/interfaces/eventbriteInterfaces';
import Page from '../components/Page/Page';
import {
  useGetCustomQuestionsQuery,
  useGetEventsQuery,
  useGetOrganizationsQuery,
  useGetTicketClassesQuery,
} from '../store/eventbriteSlice';
import { useCreateMeetupFromEventbriteMutation } from '../store/meetupSlice';
import MeetupFromEventbriteFormSchema from '../util/schemas/MeetupFromEventbriteFormSchema';

const NewMeetupFromEventbritePage = (): ReactNode => {
  const toast = useToast();
  const navigate = useNavigate();
  const formik = useFormik({
    initialValues: {
      organizationId: NaN,
      eventId: NaN,
      ticketClassId: NaN,
      customQuestionId: NaN,
      hasRaffle: true,
      defaultRaffleEntries: 1,
    },
    onSubmit: async (values) => {
      if (
        Number.isNaN(values.eventId) ||
        Number.isNaN(values.ticketClassId) ||
        Number.isNaN(values.customQuestionId)
      ) {
        console.log('invalid');
        return;
      }

      const response = await createMeetupFromEventbrite({
        eventbrite_event_id: Number(values.eventId),
        eventbrite_ticket_id: Number(values.ticketClassId),
        eventbrite_question_id: Number(values.customQuestionId),
        has_raffle: values.hasRaffle,
        default_raffle_entries: values.hasRaffle
          ? values.defaultRaffleEntries
          : formik.initialValues.defaultRaffleEntries,
      });

      if ('error' in response) {
        toast({
          title: 'Error',
          description: 'Unable to create meetup',
          status: 'error',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Meetup created successfully',
          status: 'success',
        });
        navigate('/organizer');
      }
    },
    validationSchema: MeetupFromEventbriteFormSchema,
    validateOnMount: true,
  });

  const { data: organizations } = useGetOrganizationsQuery();
  const { data: events } = useGetEventsQuery(
    Number(formik.values.organizationId),
    {
      skip: Number.isNaN(formik.values.organizationId),
    }
  );
  const { data: ticketClasses } = useGetTicketClassesQuery(
    Number(formik.values.eventId),
    {
      skip: Number.isNaN(formik.values.eventId),
    }
  );
  const { data: customQuestions } = useGetCustomQuestionsQuery(
    Number(formik.values.eventId),
    {
      skip: Number.isNaN(formik.values.eventId),
    }
  );
  const [createMeetupFromEventbrite, { isLoading }] =
    useCreateMeetupFromEventbriteMutation();

  interface FormSelectProps extends SelectProps {
    name: string;
    id: string;
    options:
      | EventbriteOrganization[]
      | EventbriteEvent[]
      | EventbriteTicket[]
      | EventbriteQuestion[]
      | undefined;
  }

  const FormSelect = ({
    name,
    id,
    options,
    onChange,
    value,
    isDisabled,
  }: FormSelectProps): ReactNode => {
    return (
      <FormControl id={id}>
        <FormLabel>{name}</FormLabel>
        <Select
          onChange={onChange}
          placeholder={'Select'}
          value={Number.isNaN(value) ? '' : value}
          isDisabled={isDisabled}
        >
          {options != null
            ? options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))
            : null}
        </Select>
      </FormControl>
    );
  };

  return (
    <Page>
      <VStack spacing={4} marginX={'0.5rem'} marginTop={'1rem'}>
        <Box textAlign={'center'}>
          <Heading>New Meetup</Heading>
          <Text>From Eventbrite Event</Text>
        </Box>
        <Container
          padding={'2rem'}
          background={'white'}
          borderRadius={'lg'}
          boxShadow={'lg'}
        >
          <form onSubmit={formik.handleSubmit} noValidate>
            <VStack spacing={4}>
              <Link
                alignSelf={'end'}
                onClick={() => {
                  navigate('/new-meetup');
                }}
                textDecoration={'underline'}
              >
                Use native
              </Link>
              <FormSelect
                name={'Organization'}
                id={'organizationId'}
                options={organizations}
                value={formik.values.organizationId}
                onChange={formik.handleChange}
              />
              <FormSelect
                name={'Event'}
                id={'eventId'}
                options={events}
                value={formik.values.eventId}
                onChange={formik.handleChange}
                isDisabled={events == null}
              />
              <FormSelect
                name={'Ticket Class'}
                id={'ticketClassId'}
                options={ticketClasses}
                value={formik.values.ticketClassId}
                onChange={formik.handleChange}
                isDisabled={ticketClasses == null}
              />
              <FormSelect
                name={'Custom Question'}
                id={'customQuestionId'}
                options={customQuestions}
                value={formik.values.customQuestionId}
                onChange={formik.handleChange}
                isDisabled={customQuestions == null}
              />

              <FormControl id="hasRaffle">
                <Stack direction="row">
                  <FormLabel margin={0} pr="4">
                    Will this meetup have raffles?
                  </FormLabel>
                  <Checkbox
                    name="hasRaffle"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    isChecked={formik.values.hasRaffle}
                  >
                    Yes
                  </Checkbox>
                </Stack>
              </FormControl>

              <FormControl
                id="defaultRaffleEntries"
                isRequired={formik.values.hasRaffle}
                isDisabled={!formik.values.hasRaffle}
                isInvalid={
                  formik.errors.defaultRaffleEntries != null &&
                  formik.touched.defaultRaffleEntries
                }
                minWidth={0}
              >
                <FormLabel noOfLines={1}>
                  Default raffle entries per attendee
                </FormLabel>
                <Input
                  type="number"
                  name="defaultRaffleEntries"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.defaultRaffleEntries}
                />
                <FormErrorMessage justifyContent={'right'}>
                  {formik.errors.defaultRaffleEntries}
                </FormErrorMessage>
              </FormControl>
              <Button
                type={'submit'}
                isDisabled={!formik.isValid}
                isLoading={isLoading}
                colorScheme={'green'}
              >
                Submit
              </Button>
            </VStack>
          </form>
        </Container>
      </VStack>
    </Page>
  );
};

export default NewMeetupFromEventbritePage;
