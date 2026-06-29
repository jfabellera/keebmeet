import { Button } from '@/components/ui/button';
import dayjs from 'dayjs';
import { type ReactNode } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { toast } from 'sonner';
import { type OrganizerRequestInfo } from '../../../backend/src/interfaces/userInterfaces';
import {
  useApproveOrganizerRequestMutation,
  useDenyOrganizerRequestMutation,
  useGetOrganizerRequestsQuery,
} from '../store/userSlice';

const AdminRequestsPage = (): ReactNode => {
  const { data: requests, isLoading } = useGetOrganizerRequestsQuery();
  const [approveRequest, { isLoading: isApproving }] =
    useApproveOrganizerRequestMutation();
  const [denyRequest, { isLoading: isDenying }] =
    useDenyOrganizerRequestMutation();
  const isBusy = isApproving || isDenying;

  const onApprove = (request: OrganizerRequestInfo): void => {
    void (async () => {
      try {
        await approveRequest(request.id).unwrap();
        toast.success(`${request.user.display_name} is now an organizer.`);
      } catch {
        toast.error('Could not approve the request. Please try again.');
      }
    })();
  };

  const onDeny = (request: OrganizerRequestInfo): void => {
    void (async () => {
      try {
        await denyRequest(request.id).unwrap();
        toast.success(`Denied ${request.user.display_name}'s request.`);
      } catch {
        toast.error('Could not deny the request. Please try again.');
      }
    })();
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Organizer requests</h1>
      {isLoading ? null : requests == null || requests.length === 0 ? (
        <p className="text-muted-foreground">No pending organizer requests.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-card text-card-foreground flex items-center justify-between gap-4 rounded-lg p-4 shadow-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium">{request.user.display_name}</span>
                <span className="text-muted-foreground text-sm">
                  {request.user.email}
                </span>
                <span className="text-muted-foreground text-xs">
                  Requested {dayjs(request.created_at).format('MMM D, YYYY')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onDeny(request)}
                  disabled={isBusy}
                >
                  <FiX />
                  Deny
                </Button>
                <Button onClick={() => onApprove(request)} disabled={isBusy}>
                  <FiCheck />
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRequestsPage;
