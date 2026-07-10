import * as Yup from 'yup';

/**
 * Validation for the archive-meetup form. Unlike a live meetup, an archive
 * records a *past* event and has no capacity/duration/raffle. Its organizer is
 * chosen one of three ways (`organizerType`), and the dependent field for the
 * chosen type is required.
 */
const ArchiveMeetupFormSchema = Yup.object().shape({
  name: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .required('Required'),
  date: Yup.date()
    .max(new Date(), 'Date must be in the past')
    .required('Required'),
  address: Yup.string().required('Required'),
  imageKey: Yup.string(),
  organizerType: Yup.string()
    .oneOf(['me', 'registered', 'unregistered'])
    .required('Required'),
  organizerId: Yup.string().when('organizerType', {
    is: 'registered',
    then: (schema) => schema.required('Select an organizer'),
  }),
  organizerName: Yup.string().when('organizerType', {
    is: 'unregistered',
    then: (schema) =>
      schema
        .max(30, 'Name must be at most 30 characters')
        .required('Enter an organizer name'),
  }),
});

export default ArchiveMeetupFormSchema;
