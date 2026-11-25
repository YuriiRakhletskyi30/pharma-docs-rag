import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold">This page does not exist.</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">The app has one page: questions about drug labels.</p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-[14px] font-medium text-white hover:bg-ink-2"
        >
          Ask a question
        </Link>
      </div>
    </main>
  );
}
