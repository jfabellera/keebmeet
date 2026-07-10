import * as Yup from 'yup';

/**
 * Validation for the archive-meetup form. Unlike a live meetup, an archive
 * records a *past* event and has no capacity/duration/raffle. The submitter
 * always owns it; `organizerType` records who ran it. It has no default, so
 * crediting is a deliberate choice rather than a silent self-attribution; when
 * someone else ran it, an organizer name is required.
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
  organizerType: Yup.string().oneOf(['me', 'other']).required('Required'),
  organizerName: Yup.string().when('organizerType', {
    is: 'other',
    then: (schema) =>
      schema
        .max(30, 'Name must be at most 30 characters')
        .required('Enter who organized this meetup'),
  }),
});

export default ArchiveMeetupFormSchema;
