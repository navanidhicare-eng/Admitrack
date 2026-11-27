import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const session = await getSession();

  if (session) {
    if (session.role === 'ADMIN') redirect('/admin');
    else if (session.role === 'TELECALLER') redirect('/telecaller');
    else if (session.role === 'COLLEGE') redirect('/college');
    else if (session.role === 'AGM') redirect('/agm');
    else redirect('/employee');
  }

  redirect('/login');
}
