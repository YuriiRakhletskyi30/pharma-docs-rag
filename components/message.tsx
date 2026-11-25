'use client';

import { Children, isValidElement, cloneElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
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
  const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');

  if (message.role === 'user') {
    return (
      <h3 className="text-lg leading-snug font-semibold tracking-[-0.015em] whitespace-pre-wrap">
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
        className={`relative mx-px inline-flex h-[18px] min-w-[18px] translate-y-[-1px] items-center justify-center rounded px-1 align-middle font-mono text-[11px] font-medium transition-colors before:absolute before:-inset-[13px] before:content-[''] ${
          selectedN === n ? 'bg-cite text-white' : 'bg-cite-soft text-cite hover:bg-cite hover:text-white'
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
      <div className="answer max-w-[70ch] text-[15.5px] leading-[1.65]">
        <ReactMarkdown
          components={{
            p: ({ node, children }) => {
              const only = node?.children.length === 1 ? node.children[0] : undefined;
              const lead = only?.type === 'element' && only.tagName === 'strong';
              return <p className={lead ? 'lead' : undefined}>{withChips(children)}</p>;
            },
            li: ({ children }) => <li>{withChips(children)}</li>,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>

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
                    className={`group flex min-h-11 w-full items-center gap-2.5 py-1 text-left sm:min-h-0 text-[13.5px] ${
                      active ? 'text-ink' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    <span
                      className={`min-w-[22px] rounded px-1 py-px text-center font-mono text-[11px] ${
                        active ? 'bg-cite text-white' : 'bg-cite-soft text-cite'
                      }`}
                    >
                      {s.n}
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
