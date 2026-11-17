import { ReminderPermissionNote } from '@/features/deadlines';
import { NotificationsScreen } from '@/features/settings';

export default function NotificationsRoute() {
  return <NotificationsScreen permissionNote={<ReminderPermissionNote />} />;
}
