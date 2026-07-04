import * as Yup from 'yup';

const MeetupFormSchema = Yup.object().shape({
  name: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .required('Required'),
  date: Yup.date()
    .min(new Date(), 'Date must be in the future')
    .required('Required'),
  startTime: Yup.string().required('Required'),
  address: Yup.string().required('Required'),
  duration: Yup.number()
    .moreThan(0, 'Must be greater than 0')
    .required('Required'),
  capacity: Yup.number()
    .moreThan(0, 'Must be greater than 0')
    .required('Required'),
  imageKey: Yup.string(),
  defaultRaffleEntries: Yup.number()
    .min(0, 'Must be non-negative')
    .required('Required'),
});

export default MeetupFormSchema;
