import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Field, FieldLabel } from '@/components/ui/field';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Input } from '@/components/ui/input';
import { useBoolean } from '@/hooks/useBoolean';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useFormik } from 'formik';
import { useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { type EditMeetupPayload } from '../../../../backend/src/util/validator';
import {
  useEditMeetupMutation,
  useGetMeetupQuery,
} from '../../store/meetupSlice';
import { hasMeetupStarted } from '../../util/timeUtil';
import EditableFormCard from '../Forms/EditableFormCard';
import EditableFormField from '../Forms/EditableFormField';

dayjs.extend(customParseFormat);

interface Props {
  meetupId: number;
}

const MeetupDetailsSettingsCard = ({ meetupId }: Props): ReactNode => {
  const { data: meetup } = useGetMeetupQuery(meetupId);
  const hasStarted = meetup != null ? hasMeetupStarted(meetup) : false;
  const [isEditable, setIsEditable] = useBoolean(false);
  const [editMeetup] = useEditMeetupMutation();
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
    },
    onSubmit: async (values) => {
      const payload: EditMeetupPayload = {};
      if (formik.initialValues.name !== values.name) payload.name = values.name;
      if (
        formik.initialValues.date !== values.date ||
        formik.initialValues.startTime !== values.startTime
      )
        payload.date = new Date(
          `${values.date}T${values.startTime}Z`
        ).toISOString();
      if (formik.initialValues.address !== values.address)
        payload.address = values.address;
      if (formik.initialValues.duration !== values.duration)
        payload.duration_hours = values.duration;
      if (formik.initialValues.capacity !== values.capacity)
        payload.capacity = values.capacity;
      if (formik.initialValues.imageUrl !== values.imageUrl)
        payload.image_url = values.imageUrl;
      if (formik.initialValues.description !== values.description)
        payload.description = values.description;

      const result = await editMeetup({ meetupId, payload });

      if ('error' in result && result.error != null && 'data' in result.error) {
        // is this allowed
        const data: any = result.error.data;
        toast.error('Error updating meetup', {
          description: data.message,
        });
      } else {
        setIsEditable.off();
      }
    },
    // TODO(jan): fix validation. Yup is giving silent fails and is making submitForm not work
    // validationSchema: MeetupFormSchema,
    validateOnMount: true,
  });

  useEffect(() => {
    formik.resetForm({
      values: {
        name: meetup?.name ?? '',
        date: dayjs(meetup?.date, 'YYYY-MM-DDTHH:mm:ss').format('YYYY-MM-DD'),
        startTime: dayjs(meetup?.date, 'YYYY-MM-DDTHH:mm:ss').format('hh:mm'),
        address: meetup?.location.full_address ?? '',
        duration: meetup?.duration_hours ?? 0,
        capacity: meetup?.tickets?.total ?? 0,
        imageUrl: meetup?.image_url ?? '',
        description: meetup?.description ?? '',
      },
    });
  }, [meetup]);

  const onSubmit = (): void => {
    void (async () => {
      await formik.submitForm();
    })();
    setIsEditable.off();
  };
  const onCancel = (): void => {
    formik.resetForm();
    setIsEditable.off();
  };

  return (
    <EditableFormCard
      title={'Meetup Details'}
      isEditable={isEditable}
      editDisabled={hasStarted}
      editDisabledReason="This meetup has already started"
      onEditEnter={setIsEditable.on}
      onEditCancel={onCancel}
      onEditSubmit={onSubmit}
      isFormInvalid={false}
    >
      <form onSubmit={formik.handleSubmit} noValidate>
        <EditableFormField
          name={'Meetup Name'}
          value={meetup?.name}
          editable={isEditable}
          id={'name'}
          type={'text'}
          isInvalid={formik.errors.name != null && formik.touched.name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errorMessage={formik.errors.name}
        />
        <EditableFormField
          name={'Date'}
          value={dayjs(meetup?.date, 'YYYY-MM-DDTHH:mm:ss').format(
            'YYYY-MM-DD'
          )}
          editable={isEditable}
          id={'date'}
          type={'date'}
          isInvalid={formik.errors.date != null && formik.touched.date}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errorMessage={formik.errors.date}
        />
        <EditableFormField
          name={'Start Time'}
          value={dayjs(meetup?.date, 'YYYY-MM-DDTHH:mm:ss').format('HH:mm')}
          editable={isEditable}
          id={'startTime'}
          type={'time'}
          isInvalid={
            formik.errors.startTime != null && formik.touched.startTime
          }
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errorMessage={formik.errors.startTime}
        />
        <EditableFormField
          name={'Address'}
          value={meetup?.location.full_address}
          editable={isEditable}
          id={'address'}
          type={'text'}
          isInvalid={formik.errors.address != null && formik.touched.address}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errorMessage={formik.errors.address}
        />
        <EditableFormField
          name={'Duration (hours)'}
          value={meetup?.duration_hours}
          editable={isEditable}
          id={'duration'}
          type={'number'}
          isInvalid={formik.errors.duration != null && formik.touched.duration}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errorMessage={formik.errors.duration}
        />
        <EditableFormField
          name={'Capacity'}
          value={meetup?.tickets?.total}
          editable={isEditable}
          id={'capacity'}
          type={'number'}
          isInvalid={formik.errors.capacity != null && formik.touched.capacity}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errorMessage={formik.errors.capacity}
        />
        <Field className="max-w-sm min-w-0 py-2">
          <FieldLabel htmlFor={'imageUrl'} className="line-clamp-1">
            Meetup Image
          </FieldLabel>
          <AspectRatio ratio={2 / 1}>
            <div className="size-full border">
              <ImageWithFallback
                src={formik.values.imageUrl}
                className="size-full object-cover"
              />
            </div>
          </AspectRatio>
          {isEditable ? (
            <Input
              id={'imageUrl'}
              name={'imageUrl'}
              className="mt-4"
              value={formik.values.imageUrl}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
          ) : null}
        </Field>
        <EditableFormField
          name={'Description'}
          value={meetup?.description}
          editable={isEditable}
          id={'description'}
          type={'text'}
          multiline
          isInvalid={
            formik.errors.description != null && formik.touched.description
          }
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errorMessage={formik.errors.description}
        />
      </form>
    </EditableFormCard>
  );
};

export default MeetupDetailsSettingsCard;
