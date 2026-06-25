import Page from '@/components/Page/Page';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { useGetMeetupQuery } from '@/store/meetupSlice';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useFormik } from 'formik';
import { type ReactNode } from 'react';
import {
  FiCalendar,
  FiClock,
  FiLock,
  FiMapPin,
  FiUser,
  FiUserCheck,
} from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import * as Yup from 'yup';
import { MeetupCapacityStatus } from '../components/Meetups/MeetupCapacityStatus';
import { useAppSelector } from '../store/hooks';
import { useCreateTicketMutation } from '../store/ticketSlice';
import { useGetUserQuery } from '../store/userSlice';
import { hasMeetupEnded, isMeetupHappeningNow } from '../util/timeUtil';

dayjs.extend(customParseFormat);

const TicketHolderSchema = Yup.object().shape({
  displayName: Yup.string().required('Required'),
  firstName: Yup.string().required('Required'),
  lastName: Yup.string().required('Required'),
  email: Yup.string().email('Invalid email').required('Required'),
});

const MeetupRsvpPage = (): ReactNode => {
  const { meetupId } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAppSelector((state) => state.user);

  const id = parseInt(meetupId ?? '');
  const { data: meetup } = useGetMeetupQuery(id, {
    skip: Number.isNaN(id),
  });
  const { data: fullUser } = useGetUserQuery(user?.id ?? NaN, {
    skip: user == null,
  });
  const [rsvp, { isLoading: isRsvping }] = useCreateTicketMutation();

  const formik = useFormik({
    // Prefilled from the fetched user; reinitialised once it loads. The user
    // can edit these to RSVP on someone else's behalf.
    initialValues: {
      displayName: fullUser?.display_name ?? '',
      firstName: fullUser?.first_name ?? '',
      lastName: fullUser?.last_name ?? '',
      email: fullUser?.email ?? '',
    },
    enableReinitialize: true,
    validationSchema: TicketHolderSchema,
    onSubmit: (values) => {
      void (async () => {
        if (meetup == null) return;
        try {
          await rsvp({
            meetupId: meetup.id,
            ticketHolder: {
              display_name: values.displayName,
              first_name: values.firstName,
              last_name: values.lastName,
              email: values.email,
            },
          }).unwrap();
          toast.success(`You're going to ${meetup.name}!`);
          void navigate('/');
        } catch {
          toast.error('Could not RSVP. Please try again.');
        }
      })();
    },
  });

  if (meetup == null) {
    return (
      <Page>
        <div className="text-muted-foreground flex justify-center p-8">
          Loading meetup…
        </div>
      </Page>
    );
  }

  const isHappeningNow = isMeetupHappeningNow(meetup);
  const hasEnded = hasMeetupEnded(meetup);

  return (
    <Page>
      <div className="flex justify-center p-4">
        <Card className="w-full max-w-4xl overflow-hidden p-0">
          {/* Reverse wrap: side-by-side on wide screens (RSVP left, details
              right); stacked on narrow screens with details on top. */}
          <div className="flex flex-wrap-reverse">
            {/* RSVP process — the larger, primary column. */}
            <form
              onSubmit={formik.handleSubmit}
              noValidate
              className="flex grow-2 basis-80 flex-col gap-4 p-6"
            >
              <div>
                <h1 className="text-2xl font-bold">Confirm your RSVP</h1>
                <p className="text-muted-foreground text-sm">
                  Reserve your spot at{' '}
                  <span className="font-semibold">{meetup.name}</span>.
                </p>
              </div>

              {meetup.tickets != null ? (
                <MeetupCapacityStatus
                  available={meetup.tickets.available}
                  total={meetup.tickets.total}
                />
              ) : null}

              <div className="flex flex-col gap-4">
                <p className="text-md font-semibold">Ticket holder details</p>
                <FormField
                  formik={formik}
                  name="displayName"
                  label="Display Name"
                  disabled={!isLoggedIn}
                />
                {/* Personal details grouped together so the "organizers only"
                    note is stated once rather than repeated per field. */}
                <div className="border-border flex flex-col gap-4 rounded-md border border-dashed p-3">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <FiLock className="size-3 shrink-0" />
                    Only visible to organizers
                  </p>
                  <div className="flex flex-row gap-2">
                    <FormField
                      formik={formik}
                      name="firstName"
                      label="First Name"
                      className="flex-1"
                      disabled={!isLoggedIn}
                    />
                    <FormField
                      formik={formik}
                      name="lastName"
                      label="Last Name"
                      className="flex-1"
                      disabled={!isLoggedIn}
                    />
                  </div>
                  <FormField
                    formik={formik}
                    name="email"
                    label="Email"
                    type="email"
                    disabled={!isLoggedIn}
                  />
                </div>
              </div>

              {hasEnded ? (
                <p className="text-sm font-semibold text-red-500">
                  This meetup has already ended.
                </p>
              ) : !isLoggedIn ? (
                <p className="text-sm font-semibold text-yellow-600">
                  You must be logged in to RSVP.
                </p>
              ) : null}

              <div className="mt-auto flex flex-col gap-3 pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    !isLoggedIn || hasEnded || isRsvping || !formik.isValid
                  }
                >
                  <FiUserCheck />
                  Confirm RSVP
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void navigate(-1)}
                >
                  Back
                </Button>
              </div>
            </form>

            {/* Banner + meetup details. */}
            <div className="bg-muted/30 grow basis-80 border-l">
              {meetup.image_url != null && meetup.image_url !== '' ? (
                <AspectRatio ratio={2 / 1}>
                  <ImageWithFallback
                    src={meetup.image_url}
                    className="size-full object-cover"
                  />
                </AspectRatio>
              ) : null}

              <div className="flex flex-col p-6">
                <h2 className="pb-2 text-xl font-bold">
                  {meetup.name}
                  {isHappeningNow ? (
                    <Badge className="ml-3 -translate-y-0.5 bg-green-600 align-middle text-white">
                      <span className="size-1.5 animate-pulse rounded-full bg-white" />
                      Happening now
                    </Badge>
                  ) : hasEnded ? (
                    <Badge
                      variant="secondary"
                      className="ml-3 -translate-y-0.5 align-middle"
                    >
                      Ended
                    </Badge>
                  ) : null}
                </h2>

                <div className="flex flex-col gap-1 pb-4 font-semibold">
                  {/* Date */}
                  <div className="flex items-start gap-2">
                    <FiCalendar className="mt-1 shrink-0" />
                    <p>
                      {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format(
                        'MMMM DD, YYYY'
                      )}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="flex items-start gap-2">
                    <FiClock className="mt-1 shrink-0" />
                    <p>
                      {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format(
                        'h:mm A'
                      )}
                      {' - '}
                      {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss')
                        .add(meetup.duration_hours ?? 0, 'hours')
                        .format('h:mm A')}
                    </p>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-2">
                    <FiMapPin className="mt-1 shrink-0" />
                    <p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          meetup.location.full_address ?? ''
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {meetup.location.full_address}
                      </a>
                    </p>
                  </div>

                  {/* Organizers */}
                  {meetup.organizers != null ? (
                    <div className="flex items-start gap-2">
                      <FiUser className="mt-1 shrink-0" />
                      <p>
                        Organized by{' '}
                        {new Intl.ListFormat().format(meetup.organizers)}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Description */}
                {meetup.description !== '' ? (
                  <>
                    <p className="font-semibold">Description</p>
                    <p className="whitespace-pre-line">{meetup.description}</p>
                  </>
                ) : (
                  <p>
                    <i>No description</i>
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
};

export default MeetupRsvpPage;
