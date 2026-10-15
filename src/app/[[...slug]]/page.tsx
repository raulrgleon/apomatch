import { notFound } from 'next/navigation';
import { CivicApp } from '@/components/civic-app';
const routes = [
  '',
  'community',
  'elections',
  'compare',
  'impact',
  'groups',
  'sources',
  'admin',
  'account',
  'login',
  'privacy',
];
export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const route = slug.join('/');
  if (!routes.includes(route)) notFound();
  return <CivicApp route={route || 'home'} />;
}
