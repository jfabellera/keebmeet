import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBoolean } from '@/hooks/useBoolean';
import { useAppSelector } from '@/store/hooks';
import { type EditMeetupPayload } from '@keebmeet/shared';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useFormik } from 'formik';
import { useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  useEditMeetupMutation,
  useGetMeetupQuery,
} from '../../store/meetupSlice';
import EditableFormCard from '../Forms/EditableFormCard';
import EditableFormField from '../Forms/EditableFormField';
import MeetupImageField from './MeetupImageField';
import OrganizerCombobox from './OrganizerCombobox';

dayjs.extend(customParseFormat);

interface Props {
  meetupId: string;
}

const MeetupDetailsSettingsCard = ({ meetupId }: Props): ReactNode => {
  const { data: meetup } = useGetMeetupQuery(meetupId);
  const currentUserId = useAppSelector((state) => state.user.user?.id);
  const [isEditable, setIsEditable] = useBoolean(false);
  const [editMeetup, { isLoading: isSaving }] = useEditMeetupMutation();
  const isArchive = meetup?.is_archive === true;
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
      organizerIds: [] as string[],
      organizerType: 'me' as 'me' | 'other',
      organizerName: '',
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
      // A new upload sets imageKey; clearing an existing image empties imageUrl.
      if (values.imageKey !== '') {
        payload.image_key = values.imageKey;
      } else if (
        values.imageUrl === '' &&
        formik.initialValues.imageUrl !== ''
      ) {
        payload.image_key = '';
      }
      if (formik.initialValues.description !== values.description)
        payload.description = values.description;
      if (
        JSON.stringify(formik.initialValues.organizerIds) !==
        JSON.stringify(values.organizerIds)
      )
        payload.organizer_ids = values.organizerIds;
      const organizerName =
        values.organizerType === 'other' ? values.organizerName : '';
      const initialOrganizerName =
        formik.initialValues.organizerType === 'other'
          ? formik.initialValues.organizerName
          : '';
      if (organizerName !== initialOrganizerName)
        payload.organizer_name = organizerName;

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
        imageKey: '',
        description: meetup?.description ?? '',
        organizerIds:
          meetup?.organizers?.map((organizer) => organizer.id) ?? [],
        organizerType: meetup?.organizer_name != null ? 'other' : 'me',
        organizerName: meetup?.organizer_name ?? '',
      },
    });
  }, [meetup]);

  const onSubmit = (): void => {
    // Leave edit mode from within the formik onSubmit once the save resolves,
    // so the Save button (and its spinner) stays visible while in flight.
    void formik.submitForm();
  };
  const onCancel = (): void => {
    formik.resetForm();
    setIsEditable.off();
  };

  return (
    <EditableFormCard
      title={'Meetup Details'}
      isEditable={isEditable}
      onEditEnter={setIsEditable.on}
      onEditCancel={onCancel}
      onEditSubmit={onSubmit}
      isSubmitLoading={isSaving}
      isFormInvalid={false}
    >
      <form onSubmit={formik.handleSubmit} noValidate>
        {isArchive ? (
          <Field className="max-w-sm min-w-0 py-2">
            <FieldLabel htmlFor="organizerType">Organizer</FieldLabel>
            {isEditable ? (
              <div className="flex flex-col gap-2">
                <Select
                  value={formik.values.organizerType}
                  onValueChange={(value) => {
                    void formik.setFieldValue('organizerType', value);
                    // Clear a stale name when switching back to self-credit.
                    if (value === 'me') {
                      void formik.setFieldValue('organizerName', '');
                    }
                  }}
                >
                  <SelectTrigger id="organizerType" className="w-full">
                    <SelectValue placeholder="Who organized this meetup?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="me">I organized this</SelectItem>
                    <SelectItem value="other">
                      Someone else organized this
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formik.values.organizerType === 'other' ? (
                  <Input
                    id="organizerName"
                    name="organizerName"
                    placeholder="Organizer name"
                    value={formik.values.organizerName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-foreground/70">
                {meetup?.organizer_name ??
                  meetup?.lead_organizer?.display_name ??
                  'N/A'}
              </p>
            )}
          </Field>
        ) : (
          <Field className="max-w-sm min-w-0 py-2">
            <FieldLabel htmlFor="organizers">Organizers</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {meetup?.lead_organizer != null ? (
                <Badge>{meetup.lead_organizer.display_name} · Lead</Badge>
              ) : null}

              {!isEditable &&
                meetup?.organizers?.map((organizer) => (
                  <Badge variant="secondary" key={organizer.id}>
                    {organizer.display_name}
                  </Badge>
                ))}
            </div>
            {isEditable && (
              <OrganizerCombobox
                id="organizers"
                disabled={
                  !isEditable || currentUserId !== meetup?.lead_organizer?.id
                }
                excludeIds={
                  meetup?.lead_organizer != null
                    ? [meetup.lead_organizer.id]
                    : []
                }
                value={formik.values.organizerIds}
                onChange={(organizerIds) =>
                  void formik.setFieldValue('organizerIds', organizerIds)
                }
              />
            )}
          </Field>
        )}
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
        {/* Archives capture the day only — no start time. */}
        {!isArchive ? (
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
        ) : null}
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
        {/* Archives have no live sign-ups or schedule. */}
        {!isArchive ? (
          <>
            <EditableFormField
              name={'Duration (hours)'}
              value={meetup?.duration_hours}
              editable={isEditable}
              id={'duration'}
              type={'number'}
              isInvalid={
                formik.errors.duration != null && formik.touched.duration
              }
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
              isInvalid={
                formik.errors.capacity != null && formik.touched.capacity
              }
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              errorMessage={formik.errors.capacity}
            />
          </>
        ) : null}
        <MeetupImageField
          previewUrl={formik.values.imageUrl}
          editable={isEditable}
          onUploaded={(imageKey, imageUrl) => {
            void formik.setFieldValue('imageKey', imageKey);
            void formik.setFieldValue('imageUrl', imageUrl);
          }}
          onRemove={() => {
            void formik.setFieldValue('imageKey', '');
            void formik.setFieldValue('imageUrl', '');
          }}
        />
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
