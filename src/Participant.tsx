import { useRef, useState } from "react";
import type { Action } from "./main";
import { checkIn, numberLabel, sendQuestion } from "./event";
import type { Cohort, EventState } from "./event";
import { SeatMap } from "./SeatMap";

type Props = { event: EventState; run: Action; busy: boolean };
type Tab = "내 자리" | "익명 Q&A";
const tabs: Tab[] = ["내 자리", "익명 Q&A"];

// getRandomValues also works on a phone opening the local network preview over HTTP.
function requestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const str = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join(
    "",
  );
  return [
    str.slice(0, 8),
    str.slice(8, 12),
    str.slice(12, 16),
    str.slice(16, 20),
    str.slice(20),
  ].join("-");
}
function Questions({ event, run, busy }: Props) {
  const [draft, setDraft] = useState(""),
    [sent, setSent] = useState(false);
  const id = useRef("");
  if (!event.open || event.ended)
    return (
      <>
        <h1>익명 Q&A</h1>
        <p className="status">지금은 질문을 받지 않아요.</p>
      </>
    );
  if (sent)
    return (
      <>
        <h1>익명 Q&A</h1>
        <section className="wash">
          <h2>질문을 보냈어요.</h2>
          <p>운영진이 현장에서 답변할 예정이에요.</p>
        </section>
        <button onClick={() => setSent(false)}>다른 질문 작성</button>
      </>
    );
  return (
    <>
      <h1>익명 Q&A</h1>
      <p>운영진만 질문을 읽고 현장에서 답해요.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          id.current ||= requestId();
          if (await run(() => sendQuestion(id.current, draft.trim()))) {
            setSent(true);
            setDraft("");
            id.current = "";
          }
        }}
      >
        <label htmlFor="question">질문 내용</label>
        <textarea
          id="question"
          maxLength={500}
          rows={5}
          disabled={busy}
          required
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            id.current = "";
          }}
          placeholder="운영진에게 궁금한 점을 적어 주세요."
        />
        <p className="muted">참가번호와 OB/YB는 질문에 표시되지 않아요.</p>
        <button className="primary" disabled={!draft.trim() || busy}>
          익명으로 질문 보내기
        </button>
      </form>
    </>
  );
}
export function Participant({ event, run, busy }: Props) {
  const [tab, setTab] = useState<Tab>("내 자리"),
    [group, setGroup] = useState<Cohort>();
  const { me } = event;
  const table = event.tables.find((t) => t.num === me?.room);
  return (
    <>
      <header>
        <strong>{event.title}</strong>
        {me && tab !== "익명 Q&A" && (
          <span>참가번호  {numberLabel(me.num)}</span>
        )}
      </header>
      <main key={tab}>
        {!me ? (
          event.ended ? (
            <h1>행사가 종료되었어요.</h1>
          ) : (
            <>
              <h1>행사 입장</h1>
              <SeatMap tables={event.tables} />
              <fieldset>
                <legend>어느 쪽으로 참여하시나요?</legend>
                <div className="choices">
                  {(["OB", "YB"] satisfies Cohort[]).map((c) => (
                    <label key={c} className={group === c ? "chosen" : ""}>
                      {c}
                      <input
                        type="radio"
                        name="cohort"
                        value={c}
                        checked={group === c}
                        onChange={() => setGroup(c)}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                className="primary"
                disabled={!group || busy}
                onClick={() => group && run(() => checkIn(group))}
              >
                참가번호 받고 입장하기
              </button>
            </>
          )
        ) : tab === "익명 Q&A" ? (
          !me.active ? (
            <h1>퇴장 처리되었어요.</h1>
          ) : (
            <Questions event={event} run={run} busy={busy} />
          )
        ) : event.ended ? (
          <>
            <h1>행사가 종료되었어요.</h1>
          </>
        ) : !me.active ? (
          <>
            <h1>퇴장 처리되었어요.</h1>
            <p>도움이 필요하면 운영진에게 알려 주세요.</p>
          </>
        ) : table ? (
          <>
            <p className="round">라운드 {event.round}</p>
            <h1 className="seat-title">{numberLabel(table.num, 2)}번 테이블</h1>
            <SeatMap tables={event.tables} current={table.num} />
            <p className="direction">{table.directions}</p>
            <section className="talk">
              <p>테이블 대화 카드</p>
              <h2>{me.card}</h2>
            </section>
          </>
        ) : (
          <>
            <p className="round">체크인 완료</p>
            <h1>자리 배정 대기 중</h1>
            <SeatMap tables={event.tables} />
            <p>
              {event.round
                ? "다음 라운드에 참여할 수 있어요."
                : "운영진이 첫 라운드를 시작하면 내 테이블이 표시돼요."}
            </p>
          </>
        )}
      </main>
      {me && (
        <nav className="bottom" aria-label="참가자 메뉴">
          {tabs.map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
