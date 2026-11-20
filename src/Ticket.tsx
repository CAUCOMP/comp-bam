import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { numberLabel } from "./event";
import type { EventState } from "./event";

export function Masthead({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="masthead">
      <strong>
        <i aria-hidden="true">C</i>
        {title}
      </strong>
      {children}
    </header>
  );
}

export function PassHeading({
  label,
  title,
  stub,
}: {
  label: string;
  title: string;
  stub?: string;
}) {
  return (
    <div className="pass-heading">
      <div>
        <p className="imprint">{label}</p>
        <h1>{title}</h1>
      </div>
      <div className="pass-stub" aria-hidden="true">
        {stub ? <b>{stub}</b> : <span className="pass-star">✦</span>}
        <i className="barcode" />
      </div>
    </div>
  );
}

const printDurationMs = 1800;
type Draw = EventState["draws"][number];

// The initial snapshot is the archive. Only a later server sequence starts a print.
export function useTicketPrint(sequence: number, visible: boolean) {
  const [printed, setPrinted] = useState(sequence);
  const printing = visible && sequence > printed;
  useEffect(() => {
    if (!printing) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setPrinted(sequence);
    if (motion.matches) {
      finish();
      return;
    }
    const timer = window.setTimeout(finish, printDurationMs);
    const onMotionChange = () => {
      if (motion.matches) finish();
    };
    motion.addEventListener("change", onMotionChange);
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [printing, sequence]);
  return { printing, printed };
}

export function TicketPrinter({
  draw,
  printing,
  ended,
}: {
  draw?: Draw;
  printing: boolean;
  ended: boolean;
}) {
  const emptyMessage = ended
    ? "발표된 당첨번호가 없어요."
    : "첫 당첨 티켓을 기다리고 있어요.";
  const result = draw ? `${draw.seq}회차 당첨번호 · ${numberLabel(draw.num)}번` : emptyMessage;
  return (
    <TicketPoster
      key={draw?.seq ?? 0}
      label={draw ? `DRAW No. ${numberLabel(draw.seq, 2)}` : "ADMIT ONE"}
      number={draw && numberLabel(draw.num)}
      printing={printing}
      caption={printing ? "당첨 티켓을 인쇄하고 있어요…" : result}
    />
  );
}

export function TicketPreview({ disabled }: { disabled: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [playback, setPlayback] = useState(0);
  const replay = () => setPlayback((previous) => previous + 1);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          dialog.current?.showModal();
          replay();
        }}
      >
        티켓 인쇄 미리보기
      </button>
      <dialog
        className="ticket-preview"
        aria-labelledby="ticket-preview-title"
        ref={dialog}
        onClose={() => setPlayback(0)}
      >
        <h2 id="ticket-preview-title">티켓 인쇄 미리보기</h2>
        {playback > 0 && (
          <TicketPoster
            key={playback}
            label="SAMPLE · 견본"
            number="000"
            printing
            caption="예시 번호 000 · 운영진 미리보기"
          />
        )}
        <div className="actions">
          <button type="button" onClick={replay}>다시 재생</button>
          <button type="button" onClick={() => dialog.current?.close()}>닫기</button>
        </div>
      </dialog>
    </>
  );
}

function TicketPoster({
  label,
  number,
  printing,
  caption,
}: {
  label: string;
  number?: string;
  printing: boolean;
  caption: string;
}) {
  return (
    <section className="print-poster">
      <span className="imprint">심야 매표소 · 럭키 드로우</span>
      <div className="poster-title" aria-hidden="true">Lucky Ticket</div>
      <div className="machine" aria-hidden="true">
        <i className="spark spark-left">✦</i>
        <i className="spark spark-right">✦</i>
        <div className="paper-guide">
          <div
            style={{ animationDuration: printDurationMs + "ms" }}
            className={"print-ticket" + (printing ? " printing" : "")}
          >
            <span className="imprint">{label}</span>
            <b>{number ?? "???"}</b>
            {number && <span className="winner-stamp">당첨</span>}
            <span className="tear-line"><i className="barcode" /></span>
          </div>
        </div>
        <div className="printer-body">
          <span>COMP TICKET CO.</span>
          <i />
        </div>
      </div>
      <p className="print-caption" role="status" aria-atomic="true">
        {caption}
      </p>
    </section>
  );
}
