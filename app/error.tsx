'use client'; // error boundaries must be Client Components

import { useEffect } from 'react';

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold">Something went wrong.</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
          The page failed to load. Your chats are kept in this browser, so nothing is lost.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-4 min-h-11 rounded-md bg-ink px-4 text-[14px] font-medium text-white hover:bg-ink-2"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
