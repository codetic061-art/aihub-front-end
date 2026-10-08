import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <main
      id="main"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '40ch' }}>
        <p style={{ fontSize: '0.875rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6 }}>
          404
        </p>
        <h1 style={{ marginTop: '0.5rem' }}>AI Hub</h1>
        <p style={{ marginTop: '1rem', opacity: 0.75 }}>
          This page does not exist. It may have moved, or it may not be published yet.
        </p>
        <p style={{ marginTop: '1.5rem' }}>
          <Link href="/en" style={{ textDecoration: 'underline' }}>
            Go to the home page
          </Link>
        </p>
      </div>
    </main>
  );
}
