import { useRef, useState } from "react";
import type { Action } from "./main";
import { checkIn, numberLabel, sendQuestion } from "./event";
import type { Cohort, EventState } from "./event";
import { SeatMap } from "./SeatMap";

type Props = { event: EventState; run: Action; busy: boolean };
type Tab = "내 자리" | "익명 Q&A" | "럭키 드로우";
const tabs: Tab[] = ["내 자리", "익명 Q&A", "럭키 드로우"];

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
  const won = event.draws.find((d) => d.num === me?.num);
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
        ) : tab === "럭키 드로우" ? (
          <>
            <h1>럭키 드로우</h1>
            {event.ended && <p>행사가 종료되었어요.</p>}
            {event.draws.length === 0 ? (
              <p className="status">아직 추첨 결과가 없어요.</p>
            ) : (
              <>
                <section className="wash">
                  <p className="eyeline">{event.draws[0].seq}회차 당첨번호</p>
                  <strong className="winner">
                    {numberLabel(event.draws[0].num)}
                  </strong>
                </section>
                {won ? (
                  <p className="winning" role="status">
                    {won.seq}회차에 당첨되었어요! 참가번호 화면을 운영진에게
                    보여주세요.
                  </p>
                ) : (
                  <p>내 참가번호는 {numberLabel(me.num)}번이에요.</p>
                )}
              </>
            )}
          </>
        ) : event.ended ? (
          <>
            <h1>행사가 종료되었어요.</h1>
            <p>럭키 드로우에서 당첨 결과를 확인할 수 있어요.</p>
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
