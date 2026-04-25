import { redirect } from 'next/navigation';

export default function DashboardPage() {
  // Redirect to tasks as the default dashboard view
  redirect('/tasks');
}