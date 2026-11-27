import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { claimHost, hostPage, readEvent } from "./event";
import type { EventState } from "./event";
import { Participant } from "./Participant";
import { Masthead, PassHeading } from "./Ticket";
import { Host } from "./Host";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
import "@fontsource/dm-sans/latin-700.css";
import "./style.css";

export type Action = (work: () => Promise<unknown>) => Promise<boolean>;
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "연결 상태를 확인하고 다시 시도해 주세요.";
}

function HostLogin({ run, busy }: { run: Action; busy: boolean }) {
  return (
    <form
      className="host-login"
      onSubmit={(event) => {
        event.preventDefault();
        const link = new FormData(event.currentTarget).get("invite");
        void run(async () => {
          let url: URL;
          try {
            url = new URL(String(link).trim());
          } catch {
            throw new Error("운영진에게 받은 링크 전체를 붙여 넣어 주세요.");
          }
          const key = new URLSearchParams(url.hash.slice(1)).get("key");
          if (url.origin !== location.origin || !key || url.pathname.replace(/\/$/, "") !== "/admin")
            throw new Error("이 행사의 비공개 운영 링크를 확인해 주세요.");
          await claimHost(key);
        });
      }}
    >
      <label htmlFor="invite">비공개 운영 링크</label>
      <input id="invite" name="invite" type="password" autoComplete="off" required />
      <button className="primary" disabled={busy}>운영 화면 열기</button>
    </form>
  );
}

function App() {
  const [event, setEvent] = useState<EventState>();
  const [connection, setConnection] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++version.current;
    try {
      const current = await readEvent();
      if (id === version.current) {
        setEvent(current);
        setConnection("");
      }
    } catch (error) {
      if (id === version.current) setConnection(message(error));
    }
  }, []);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh();
      if (alive) timer = setTimeout(poll, 4000);
    };
    const resume = () => {
      if (!document.hidden) void refresh();
    };
    void poll();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [refresh]);
  const run: Action = async (work) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setProblem("");
    try {
      await work();
      await refresh();
      return true;
    } catch (error) {
      setProblem(message(error));
      await refresh();
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const notice = (connection || problem) && (
    <div className="alert" role="alert">
      {problem || connection}{" "}
      <button
        onClick={() => {
          setProblem("");
          void refresh();
        }}
      >
        다시 확인
      </button>
    </div>
  );
  if (!event)
    return (
      <main className="shell startup">
        <Masthead title="COMP인의 밤" />
        <PassHeading label="심야 매표소" title={hostPage ? "행사 운영" : "행사 입장"} />
        {hostPage && connection && <HostLogin run={run} busy={busy} />}
        {notice || <p role="status">행사 정보를 불러오고 있어요.</p>}
      </main>
    );
  return (
    <div className={"shell" + (hostPage ? " host" : "")}>
      {notice}
      {hostPage && event.staff ? (
        <Host event={event} staff={event.staff} run={run} busy={busy} />
      ) : (
        <Participant event={event} run={run} busy={busy} />
      )}
    </div>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
