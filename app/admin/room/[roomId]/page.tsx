import { redirect } from 'next/navigation';
import { checkIsAdmin } from '@/lib/session';
import { AdminRoomClient } from './AdminRoomClient';

export default async function AdminRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const { roomId } = await params;

  return <AdminRoomClient roomId={roomId} />;
}
