import { useState } from "react";
import type { Action } from "./main";
import { checkIn, numberLabel } from "./event";
import type { Cohort, EventState } from "./event";
import { SeatMap } from "./SeatMap";

type Props = { event: EventState; run: Action; busy: boolean };
type Tab = "내 자리";
const tabs: Tab[] = ["내 자리"];

export function Participant({ event, run, busy }: Props) {
  const [tab, setTab] = useState<Tab>("내 자리"),
    [group, setGroup] = useState<Cohort>();
  const { me } = event;
  const table = event.tables.find((t) => t.num === me?.room);
  return (
    <>
      <header>
        <strong>{event.title}</strong>
        {me && (
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
