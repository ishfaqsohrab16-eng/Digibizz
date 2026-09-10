import { ReactNode } from "react";

/**
 * The frame every printed report shares: who, when, what state it is in, the
 * content, and the signatures the paper form carried.
 *
 * The STATUS STAMP sits in the top corner because it is the first thing a
 * reader of a printed report needs - whether anybody senior has looked at
 * this yet. A reviewed report prints who reviewed it and when, and their note;
 * an unreviewed one says so plainly rather than leaving a blank where the
 * review would be.
 *
 * The signature lines stay BLANK apart from the name of whoever filed it. The
 * digital review is shown in the stamp; the lines are for the wet signatures
 * the printed copy is often being produced to collect.
 *
 * Styled by index.css (".print-doc") in points, not pixels - it is going onto
 * paper, and a report that runs onto a second page is a report that gets
 * stapled in the wrong order.
 */

export interface PrintMeta {
  label: string;
  value: ReactNode;
  /** Spans the full width - for long values such as a list of classes. */
  wide?: boolean;
}

export interface PrintStatus {
  status: string;
  submittedOn?: string | null;
  reviewedBy?: string | null;
  reviewedOn?: string | null;
  note?: string | null;
}

export interface PrintSignature {
  role: string;
  name?: string | null;
}

/** "2026-09-04" read as a LOCAL date, so it never shifts a day in UTC. */
const toDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (match && value.length <= 10) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
};

export const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** "04 Sep", for a column heading. */
export const shortDate = (value?: string | null) => {
  if (!value) return "";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const isoPlus = (iso: string, offset: number) => {
  const date = toDate(iso.slice(0, 10));
  date.setDate(date.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * The five teaching days of an M&E week, Friday to Thursday.
 *
 * Taken from the server's week when there is one. Otherwise worked out from
 * the week's starting Friday, so a report opened from a list that did not
 * fetch its week still prints real dates over its columns.
 */
export const reportDays = (
  weekStart: string,
  days?: Array<{ key: string; label: string; date: string }> | null
) =>
  days?.length
    ? days
    : [
        { key: "fri", label: "Fri", offset: 0 },
        { key: "mon", label: "Mon", offset: 3 },
        { key: "tue", label: "Tue", offset: 4 },
        { key: "wed", label: "Wed", offset: 5 },
        { key: "thu", label: "Thurs", offset: 6 },
      ].map((day) => ({ key: day.key, label: day.label, date: isoPlus(weekStart, day.offset) }));

const StatusStamp = ({ status, submittedOn, reviewedBy, reviewedOn }: PrintStatus) => {
  if (status === "reviewed") {
    return (
      <div className="print-stamp reviewed">
        <strong>REVIEWED</strong>
        {reviewedBy && <span>by {reviewedBy}</span>}
        {reviewedOn && <span>on {formatDate(reviewedOn)}</span>}
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <div className="print-stamp submitted">
        <strong>SUBMITTED</strong>
        <span>Awaiting review</span>
        {submittedOn && <span>on {formatDate(submittedOn)}</span>}
      </div>
    );
  }

  return (
    <div className="print-stamp draft">
      <strong>DRAFT</strong>
      <span>Not yet submitted</span>
    </div>
  );
};

export const PrintSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="print-section">
    <h2>{title}</h2>
    {children}
  </section>
);

/** A free-text box that still shows as a box when it is empty. */
export const PrintText = ({ value }: { value?: string | null }) => (
  <div className="print-text">{value?.trim() ? value : <span className="print-empty">—</span>}</div>
);

interface Props {
  title: string;
  subtitle?: string;
  meta: PrintMeta[];
  status: PrintStatus;
  signatures: PrintSignature[];
  children: ReactNode;
}

export function PrintDocument({ title, subtitle, meta, status, signatures, children }: Props) {
  return (
    <article className="print-doc">
      <header className="print-head">
        <div>
          <p className="print-kicker">Digibizz Program · Monitoring &amp; Evaluation</p>
          <h1>{title}</h1>
          {subtitle && <p className="print-sub">{subtitle}</p>}
        </div>
        <StatusStamp {...status} />
      </header>

      <dl className="print-meta">
        {meta.map((item) => (
          <div key={item.label} className={item.wide ? "wide" : undefined}>
            <dt>{item.label}</dt>
            <dd>{item.value || <span className="print-empty">—</span>}</dd>
          </div>
        ))}
      </dl>

      {status.status === "reviewed" && status.note?.trim() && (
        <div className="print-review-note">
          <strong>Reviewer&rsquo;s note: </strong>
          {status.note}
        </div>
      )}

      <main>{children}</main>

      <footer className="print-foot">
        <div className="print-signs">
          {signatures.map((signature) => (
            <div key={signature.role} className="print-sign">
              <div className="print-sign-line" />
              {signature.role}
              {signature.name && <small>{signature.name}</small>}
            </div>
          ))}
        </div>
        <p className="print-printed">
          {status.submittedOn ? `Submitted ${formatDateTime(status.submittedOn)} · ` : ""}
          Printed {formatDateTime(new Date().toISOString())} from the Digibizz LMS
        </p>
      </footer>
    </article>
  );
}

export default PrintDocument;
