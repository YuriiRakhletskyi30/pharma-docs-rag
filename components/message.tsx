'use client';

import { SearchX } from 'lucide-react';
import { Children, isValidElement, cloneElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { NOT_FOUND } from '@/lib/rag/prompt';
import type { ChatMessage, SourceRef } from '@/lib/types';
import { drugName, sourceLabel } from './cite';

type Props = {
  message: ChatMessage;
  /** source number open in the panel, if it belongs to this message */
  selectedN: number | null;
  onCite: (s: SourceRef) => void;
  onExample: () => void;
};

export function Message({ message, selectedN, onCite, onExample }: Props) {
  const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg bg-rail px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {text}
        </p>
      </div>
    );
  }

  if (text.trim() === NOT_FOUND) {
    return (
      <div className="flex max-w-[70ch] gap-3 rounded-lg border border-line bg-panel px-4 py-3">
        <SearchX className="mt-0.5 size-4 shrink-0 text-ink-2" strokeWidth={1.75} />
        <div className="text-[14px] leading-relaxed">
          <p className="font-medium">Not in the loaded labels.</p>
          <p className="mt-0.5 text-ink-2">
            No passage answered this, so nothing was generated. The labels cover dosing, interactions, warnings and use
            in specific populations for the drugs on the left.
          </p>
          <button
            type="button"
            onClick={onExample}
            className="mt-1 min-h-11 font-medium text-accent-strong hover:underline lg:min-h-0 lg:py-1"
          >
            Try an example question
          </button>
        </div>
      </div>
    );
  }

  const sources = message.parts.find((p) => p.type === 'data-sources')?.data.items ?? [];
  const invalid = new Set(message.parts.find((p) => p.type === 'data-citations')?.data.invalid ?? []);
  const byN = new Map(sources.map((s) => [s.n, s]));
  const cited = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))]
    .map((n) => byN.get(n))
    .filter((s): s is SourceRef => !!s);

  const chip = (n: number, key: string) => {
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
        title={sourceLabel(s)}
        aria-label={`Source ${n}: ${sourceLabel(s)}`}
        // the ::before pad gives a ~44 px tap area without changing the look
        className={`relative mx-0.5 inline-flex h-[18px] min-w-[18px] translate-y-[-1px] items-center justify-center rounded px-1 align-middle text-[11.5px] font-semibold tabular-nums transition-colors before:absolute before:-inset-[13px] before:content-[''] ${
          selectedN === n ? 'bg-accent text-white' : 'bg-accent-soft text-accent-strong hover:bg-accent hover:text-white'
        }`}
      >
        {n}
      </button>
    );
  };

  // Replace "[n]" in rendered text nodes with clickable chips.
  const withChips = (children: ReactNode): ReactNode =>
    Children.map(children, (child) => {
      if (typeof child === 'string') {
        return child.split(/(\[\d+\])/g).map((part, i) => {
          const m = part.match(/^\[(\d+)\]$/);
          return m ? chip(Number(m[1]), `${i}`) : part;
        });
      }
      if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
        return cloneElement(child, undefined, withChips(child.props.children));
      }
      return child;
    });

  return (
    <div>
      <div className="answer max-w-[70ch] text-[15px] leading-relaxed">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p>{withChips(children)}</p>,
            li: ({ children }) => <li>{withChips(children)}</li>,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>

      {cited.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
          {cited.map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => onCite(s)}
              title={sourceLabel(s)}
              className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-left text-[12.5px] transition-colors sm:min-h-0 sm:max-w-[46ch] ${
                selectedN === s.n
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-line bg-panel text-ink-2 hover:border-accent hover:text-accent-strong'
              }`}
            >
              <span className="font-semibold tabular-nums">{s.n}</span>
              <span className="shrink-0">{drugName(s)}</span>
              {s.heading && <span className="min-w-0 truncate">· {s.heading}</span>}
              <span className="shrink-0 tabular-nums">· p. {s.page}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
