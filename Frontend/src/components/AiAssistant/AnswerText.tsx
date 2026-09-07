import React from "react";

/**
 * The answer, formatted.
 *
 * The summary arrives as plain text and used to be rendered as one flat block
 * with `whitespace-pre-wrap`. Models write in paragraphs and bullet lists, and
 * a five-sentence answer with three findings in it read as a wall.
 *
 * Deliberately NOT a markdown renderer. A dependency would bring a parser and
 * an HTML sink for text that originates from a language model reading rows of
 * the database - the one place a stray `<img onerror>` in a candidate's name
 * could end up executing. This builds React elements from four patterns and
 * cannot emit HTML at all, so the worst a hostile string can do is look odd.
 *
 *   blank line   -> a new paragraph
 *   - or * or •  -> a bullet
 *   1. 2. 3.     -> a numbered list
 *   **text**     -> bold
 */

/** Split on **bold**, keeping the delimiters' contents. */
const withEmphasis = (line: string, keyPrefix: string) => {
  const parts = line.split(/\*\*(.+?)\*\*/g);

  // Odd indices are what sat inside the asterisks.
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={`${keyPrefix}-${index}`} className="font-semibold text-slate-900">
        {part}
      </strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>
    )
  );
};

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*(\d+)[.)]\s+/;

const AnswerText: React.FC<{ text: string }> = ({ text }) => {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const blocks: React.ReactNode[] = [];

  // A run of consecutive list lines becomes one list; anything else is a
  // paragraph. Tracked as a buffer so a list is not broken into single-item
  // lists by the loop.
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!list) return;

    const { ordered, items } = list;
    const className = "my-1.5 space-y-1 pl-5 text-[0.95rem] leading-relaxed text-slate-700";

    blocks.push(
      ordered ? (
        <ol key={key} className={`${className} list-decimal marker:text-slate-400`}>
          {items.map((item, index) => (
            <li key={index} className="pl-1">
              {withEmphasis(item, `${key}-${index}`)}
            </li>
          ))}
        </ol>
      ) : (
        <ul key={key} className={`${className} list-disc marker:text-emerald-500`}>
          {items.map((item, index) => (
            <li key={index} className="pl-1">
              {withEmphasis(item, `${key}-${index}`)}
            </li>
          ))}
        </ul>
      )
    );

    list = null;
  };

  trimmed.split("\n").forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const key = `b${index}`;

    if (!line.trim()) {
      flushList(key);
      return;
    }

    const bullet = BULLET.test(line);
    const numbered = !bullet && NUMBERED.test(line);

    if (bullet || numbered) {
      const content = line.replace(bullet ? BULLET : NUMBERED, "");

      // A change of list type starts a new list rather than mixing markers.
      if (list && list.ordered !== numbered) flushList(`${key}-flush`);
      if (!list) list = { ordered: numbered, items: [] };

      list.items.push(content);
      return;
    }

    flushList(`${key}-flush`);
    blocks.push(
      <p key={key} className="text-[0.95rem] leading-relaxed text-slate-800">
        {withEmphasis(line, key)}
      </p>
    );
  });

  flushList("tail");

  return <div className="space-y-2">{blocks}</div>;
};

export default AnswerText;
