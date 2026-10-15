'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>We could not load this page.</h1>
      <p>Please try again. / Inténtalo de nuevo.</p>
      <Button onClick={reset}>Try again / Reintentar</Button>
    </main>
  );
}
