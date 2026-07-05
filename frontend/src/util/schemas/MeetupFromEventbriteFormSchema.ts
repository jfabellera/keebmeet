import * as Yup from 'yup';

const MeetupFromEventbriteFormSchema = Yup.object().shape({
  organizationId: Yup.string().required(),
  eventId: Yup.string().required(),
  ticketClassId: Yup.string().required(),
  customQuestionId: Yup.string().required(),
  defaultRaffleEntries: Yup.number()
    .min(0, 'Must be non-negative')
    .required('Required'),
});

export default MeetupFromEventbriteFormSchema;
