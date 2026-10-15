import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>404</h1>
      <p>Page not found / Página no encontrada.</p>
      <Link href="/">ApoMatch →</Link>
    </main>
  );
}
