import { redirect } from 'next/navigation';
import { checkIsAdmin } from '@/lib/session';
import { QuestionsClient } from './QuestionsClient';

export default async function AdminQuestionsPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const { roomId } = await params;

  return <QuestionsClient roomId={roomId} />;
}
