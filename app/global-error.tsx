'use client'; // replaces the root layout when it fails, so it brings its own <html> and <body>

import './globals.css';

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-6 font-sans">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold">Drug Label Q&amp;A could not load.</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-2">Reload the page, or try again in a minute.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-4 min-h-11 rounded-md bg-ink px-4 text-[14px] font-medium text-white hover:bg-ink-2"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
