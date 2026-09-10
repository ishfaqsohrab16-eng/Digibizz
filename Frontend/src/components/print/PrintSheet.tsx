import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";

/**
 * Print one document, and nothing else on the page.
 *
 * The document is rendered into its own element directly under <body>, and a
 * class on <html> tells the print stylesheet to hide every other child of
 * <body> for the duration. `display: none` rather than `visibility`, because
 * index.css already forces `body * { visibility: visible !important }` for
 * the older print screens, and a visibility rule would lose to it.
 *
 * WHAT IS PRINTED IS A DOCUMENT, NOT THE SCREEN. The on-screen report is built
 * for scrolling and clicking; the printed one for an A4 page with signatures
 * at the bottom. They share the data, not the layout.
 *
 * Photographs are waited for before the dialog opens, so they do not print as
 * empty boxes - with a limit, because a photograph that never loads must not
 * stop the report printing at all.
 */
export function PrintSheet({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  const [host] = useState(() => {
    const element = document.createElement("div");
    element.className = "print-root";
    return element;
  });

  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    document.body.appendChild(host);
    document.documentElement.classList.add("printing-report");

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.documentElement.classList.remove("printing-report");
      done.current();
    };

    window.addEventListener("afterprint", finish);

    // The second signal the dialog has closed, for the browsers whose
    // afterprint is unreliable: print media stops matching.
    const printMedia = window.matchMedia?.("print");
    const onMedia = (event: MediaQueryListEvent) => {
      if (!event.matches) finish();
    };
    printMedia?.addEventListener?.("change", onMedia);

    const images = Array.from(host.querySelectorAll("img"));
    const loaded = Promise.all(
      images.map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            })
      )
    );
    const patience = new Promise<void>((resolve) => window.setTimeout(resolve, 4000));

    let cancelled = false;
    Promise.race([loaded, patience]).then(() => {
      if (cancelled) return;
      window.requestAnimationFrame(() => window.print());
    });

    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", finish);
      printMedia?.removeEventListener?.("change", onMedia);
      document.documentElement.classList.remove("printing-report");
      host.remove();
    };
  }, [host]);

  return createPortal(children, host);
}

/**
 * A Print button that renders its document only while printing.
 *
 * `render` is called on demand rather than taking a ready element, so a
 * screen showing a list of reports does not build a hidden printable copy of
 * every one of them.
 */
export function PrintButton({
  render,
  label = "Print",
  className,
}: {
  render: () => ReactNode;
  label?: string;
  className?: string;
}) {
  const [printing, setPrinting] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setPrinting(true)}
        disabled={printing}
        title="Print this report on one A4 page"
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        }
      >
        <Printer className="h-3.5 w-3.5" />
        {printing ? "Preparing…" : label}
      </button>
      {printing && <PrintSheet onDone={() => setPrinting(false)}>{render()}</PrintSheet>}
    </>
  );
}

export default PrintButton;
