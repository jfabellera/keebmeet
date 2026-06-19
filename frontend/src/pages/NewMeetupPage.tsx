import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  Stack,
  Text,
  Textarea,
  useColorModeValue,
  useToast,
  type BoxProps,
} from '@chakra-ui/react';
import { useFormik } from 'formik';
import { type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../components/Page/Page';
import { useCreateMeetupMutation } from '../store/meetupSlice';
import MeetupFormSchema from '../util/schemas/MeetupFormSchema';

const NewMeetupPage = (): ReactNode => {
  const [createMeetup] = useCreateMeetupMutation();
  const navigate = useNavigate();
  const toast = useToast();
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
        toast({
          title: 'Error creating meetup',
          description: data.message,
          status: 'error',
          isClosable: true,
        });
      } else {
        navigate('/organizer');
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

  const ErrorMessage = ({ children }: BoxProps): ReactNode => {
    return (
      <FormErrorMessage justifyContent={'right'}>{children}</FormErrorMessage>
    );
  };

  return (
    <Page>
      <Container padding={'1rem'} maxWidth={'contanier.md'}>
        <Stack padding={0} mx={'auto'} maxW={'lg'} spacing={4}>
          <Heading fontSize={'4xl'} textAlign={'center'}>
            New Meetup
          </Heading>
          <Box
            rounded={'lg'}
            bg={useColorModeValue('white', 'gray.700')}
            boxShadow={'lg'}
            p={8}
          >
            <form onSubmit={formik.handleSubmit} noValidate>
              <Stack spacing={4}>
                <Link
                  alignSelf={'end'}
                  onClick={() => {
                    navigate('/new-meetup/eventbrite');
                  }}
                  textDecoration={'underline'}
                >
                  Use Eventbrite
                </Link>
                <FormControl
                  id="name"
                  isRequired
                  isInvalid={formik.errors.name != null && formik.touched.name}
                  minWidth={0}
                >
                  <FormLabel noOfLines={1}>Meetup Name</FormLabel>
                  <Input
                    type="text"
                    name="name"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <ErrorMessage>{formik.errors.name}</ErrorMessage>
                </FormControl>

                <HStack align={'baseline'}>
                  <FormControl
                    id="date"
                    isRequired
                    isInvalid={
                      formik.errors.date != null && formik.touched.date
                    }
                    minWidth={0}
                  >
                    <FormLabel noOfLines={1}>Date</FormLabel>
                    <Input
                      type="date"
                      name="date"
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <ErrorMessage>{formik.errors.date}</ErrorMessage>
                  </FormControl>

                  <FormControl
                    id="startTime"
                    isRequired
                    isInvalid={
                      formik.errors.startTime != null &&
                      formik.touched.startTime
                    }
                    minWidth={0}
                  >
                    <FormLabel noOfLines={1}>Start Time</FormLabel>
                    <Input
                      type="time"
                      name="startTime"
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <ErrorMessage>{formik.errors.startTime}</ErrorMessage>
                  </FormControl>
                </HStack>

                <HStack align={'baseline'}>
                  <FormControl
                    id="duration"
                    isRequired
                    isInvalid={
                      formik.errors.duration != null && formik.touched.duration
                    }
                    minWidth={0}
                  >
                    <FormLabel noOfLines={1} wordBreak={'break-all'}>
                      Duration (hours)
                    </FormLabel>
                    <Input
                      type="number"
                      name="duration"
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <ErrorMessage>{formik.errors.duration}</ErrorMessage>
                  </FormControl>

                  <FormControl
                    id="capacity"
                    isRequired
                    isInvalid={
                      formik.errors.capacity != null && formik.touched.capacity
                    }
                    minWidth={0}
                  >
                    <FormLabel noOfLines={1}>Capacity</FormLabel>
                    <Input
                      type="number"
                      name="capacity"
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <ErrorMessage>{formik.errors.capacity}</ErrorMessage>
                  </FormControl>
                </HStack>

                <FormControl
                  id="address"
                  isRequired
                  isInvalid={
                    formik.errors.address != null && formik.touched.address
                  }
                  minWidth={0}
                >
                  <FormLabel noOfLines={1}>Address</FormLabel>
                  <Input
                    type="text"
                    name="address"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <ErrorMessage>{formik.errors.address}</ErrorMessage>
                </FormControl>

                <FormControl
                  id="imageUrl"
                  isRequired
                  isInvalid={
                    formik.errors.imageUrl != null && formik.touched.imageUrl
                  }
                  minWidth={0}
                >
                  <FormLabel noOfLines={1}>Image URL</FormLabel>
                  <Input
                    type="text"
                    name="imageUrl"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <ErrorMessage>{formik.errors.imageUrl}</ErrorMessage>
                </FormControl>

                <FormControl id="description" minWidth={0}>
                  <FormLabel noOfLines={1}>Description</FormLabel>
                  <Textarea
                    name="description"
                    onChange={onDescriptionChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.description}
                  />
                  <Text
                    textAlign={'right'}
                    fontSize={'sm'}
                    marginTop="0.2rem"
                    textColor={
                      formik.values.description.length === 500 ? 'red' : 'black'
                    }
                  >
                    {formik.values.description.length} / 500
                  </Text>
                </FormControl>

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
                  <ErrorMessage>
                    {formik.errors.defaultRaffleEntries}
                  </ErrorMessage>
                </FormControl>

                <Button
                  type="submit"
                  loadingText="Submitting"
                  isDisabled={!formik.isValid}
                  size="lg"
                  bg={'blue.400'}
                  color={'white'}
                  _hover={{
                    bg: 'blue.500',
                  }}
                >
                  Create
                </Button>
              </Stack>
            </form>
          </Box>
        </Stack>
      </Container>
    </Page>
  );
};

export default NewMeetupPage;
