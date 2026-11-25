'use client';

import { Children, isValidElement, cloneElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage, SourceRef } from '@/lib/types';
import { sourceLabel } from './cite';

type Props = {
  message: ChatMessage;
  selected: SourceRef | null;
  onCite: (s: SourceRef) => void;
};

export function Message({ message, selected, onCite }: Props) {
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
    const active = selected?.documentId === s.documentId && selected.page === s.page && selected.n === s.n;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onCite(s)}
        title={sourceLabel(s)}
        aria-label={`Source ${n}: ${sourceLabel(s)}`}
        className={`mx-0.5 inline-flex h-[18px] min-w-[18px] translate-y-[-1px] items-center justify-center rounded px-1 align-middle text-[11.5px] font-semibold tabular-nums transition-colors ${
          active ? 'bg-accent text-white' : 'bg-accent-soft text-accent-strong hover:bg-accent hover:text-white'
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
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cited.map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => onCite(s)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12.5px] transition-colors ${
                selected?.n === s.n && selected.page === s.page && selected.documentId === s.documentId
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-line bg-panel text-ink-2 hover:border-accent hover:text-accent-strong'
              }`}
            >
              <span className="font-semibold tabular-nums">{s.n}</span>
              <span className="max-w-[34ch] truncate">{sourceLabel(s)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
