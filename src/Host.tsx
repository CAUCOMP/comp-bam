import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { numberLabel, operate } from "./event";
import type { EventState, Staff } from "./event";
import type { Action } from "./main";
import { assign } from "./assign";
import { SeatMap } from "./SeatMap";
import { Masthead, PassHeading, TicketPrinter, useTicketPrint } from "./Ticket";

type Props = { event: EventState; staff: Staff; run: Action; busy: boolean };
type Panel = "현장 진행" | "익명 Q&A" | "럭키 드로우";
const panels: Panel[] = ["현장 진행", "익명 Q&A", "럭키 드로우"];

export function Host({ event, staff, run, busy }: Props) {
  const [panel, setPanel] = useState<Panel>("현장 진행");
  const [qr, setQr] = useState(false);
  const [filter, setFilter] =
    useState<Staff["questions"][number]["state"]>("pending");
  const active = staff.members.filter((m) => m.active);
  const ob = active.filter((m) => m.cohort === "OB").length;
  const totalSeats = event.tables.reduce((sum, t) => sum + t.capacity, 0);
  const eligible = active.filter(
    (m) => !event.draws.some((d) => d.num === m.num),
  ).length;
  const seats = staff.history.filter((s) => s.round_no === event.round);
  const disabled = busy || event.ended;
  const latest = event.draws[0];
  const { printed, printing } = useTicketPrint(latest?.seq ?? 0, panel === "럭키 드로우");
  const joinUrl = new URL("/", location.origin).href;
  return (
    <>
      <Masthead title={event.title}>
        <span className="operator">운영진</span>
        <button aria-expanded={qr} onClick={() => setQr(!qr)}>
          {qr ? "QR 닫기" : "참가용 QR"}
        </button>
      </Masthead>
      {qr && (
        <section className="qr">
          <h2>참가용 QR</h2>
          <QRCodeSVG
            value={joinUrl}
            size={192}
            marginSize={4}
            title="행사 입장 QR"
          />
          <a href={joinUrl}>{joinUrl}</a>
          {["localhost", "127.0.0.1"].includes(location.hostname) && (
            <p>
              휴대폰에서 스캔하려면 같은 Wi-Fi의 컴퓨터 IP 주소로 운영 화면을
              열어 주세요.
            </p>
          )}
        </section>
      )}
      <nav className="host-tabs" aria-label="운영진 메뉴">
        {panels.map((t) => (
          <button
            key={t}
            aria-current={t === panel ? "page" : undefined}
            onClick={() => setPanel(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <main>
        <div className="heading">
          <PassHeading label="심야 매표소 / 운영진" title={panel} />
          <span>
            {event.ended
              ? "행사 종료"
              : event.round
                ? `라운드 ${event.round}`
                : "체크인 중"}
          </span>
        </div>
        {panel === "현장 진행" && (
          <>
            <div className="metrics">
              {[
                ["활성 인원", active.length + "명"],
                ["OB", ob + "명"],
                ["YB", active.length - ob + "명"],
                ["전체 좌석", totalSeats + "석"],
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <button
              className="primary"
              disabled={
                disabled || !active.length || active.length > totalSeats
              }
              onClick={() =>
                run(() =>
                  operate("round", {
                    expected: event.round,
                    seats: assign(staff, event.tables),
                  }),
                )
              }
            >
              {event.round ? "다음 라운드 시작" : "첫 라운드 시작"}
            </button>
            {active.length > totalSeats && (
              <p role="alert">
                좌석 {active.length - totalSeats}개가 더 필요해요.
              </p>
            )}
            <div className="host-grid">
              <section>
                <h2>테이블 배정</h2>
                <SeatMap tables={event.tables} />
                <ul>
                  {event.tables.map((t) => (
                    <li key={t.num}>
                      <strong>
                        {numberLabel(t.num, 2)}번{" "}
                        <small>정원 {t.capacity}명</small>
                      </strong>
                      <span>
                        {seats
                          .filter((s) => s.room === t.num)
                          .map((s) => numberLabel(s.num))
                          .join(" · ") || "배정 대기"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2>참가자 명단</h2>
                {!staff.members.length && <p>첫 체크인을 기다리고 있어요.</p>}
                <ul>
                  {[...staff.members].reverse().map((m) => (
                    <li key={m.num}>
                      <strong>
                        {numberLabel(m.num)} <small>{m.cohort}</small>
                      </strong>
                      {m.active ? (
                        <button
                          disabled={disabled}
                          onClick={() => {
                            if (
                              confirm(
                                numberLabel(m.num) + "번을 퇴장 처리할까요?",
                              )
                            )
                              void run(() => operate("depart", { num: m.num }));
                          }}
                        >
                          퇴장 처리
                        </button>
                      ) : (
                        <span>퇴장</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
        {panel === "익명 Q&A" && (
          <>
            <div className="setting">
              <span>{event.open ? "질문 접수 중" : "질문 접수 마감"}</span>
              <button
                disabled={disabled}
                onClick={() =>
                  run(() => operate("reception", { open: !event.open }))
                }
              >
                {event.open ? "접수 마감" : "접수 열기"}
              </button>
            </div>
            <div className="filters">
              {(["pending", "answered", "hidden"] as const).map((s, i) => (
                <button
                  key={s}
                  aria-pressed={filter === s}
                  onClick={() => setFilter(s)}
                >
                  {["답변 대기", "완료", "숨김"][i]}{" "}
                  {staff.questions.filter((q) => q.state === s).length}
                </button>
              ))}
            </div>
            {!staff.questions.some((q) => q.state === filter) && (
              <p className="status">이 목록에 질문이 없어요.</p>
            )}
            {staff.questions
              .filter((q) => q.state === filter)
              .map((q) => (
                <article key={q.id}>
                  <p>{q.body}</p>
                  {q.state === "pending" && (
                    <div className="actions">
                      <button
                        disabled={disabled}
                        onClick={() =>
                          run(() =>
                            operate("moderate", {
                              id: q.id,
                              state: "answered",
                            }),
                          )
                        }
                      >
                        답변 완료
                      </button>
                      <button
                        disabled={disabled}
                        onClick={() =>
                          run(() =>
                            operate("moderate", { id: q.id, state: "hidden" }),
                          )
                        }
                      >
                        숨기기
                      </button>
                    </div>
                  )}
                </article>
              ))}
          </>
        )}
        {panel === "럭키 드로우" && (
          <>
            <TicketPrinter draw={latest} printing={printing} ended={event.ended} />
            <section className="draw-controls">
              <p>
                추첨 가능 인원  <b>{eligible}명</b>
              </p>
              <button
                className="primary"
                disabled={disabled || printing || !eligible}
                onClick={() => {
                  if (
                    !event.draws.length ||
                    confirm(
                      "현재 당첨 결과를 확인했나요? 다음 한 명을 추첨합니다.",
                    )
                  )
                    void run(() =>
                      operate("draw", { expected: event.draws.length }),
                    );
                }}
              >
                {event.draws.length ? "다음 한 명 추첨" : "한 명 추첨"}
              </button>
              {!eligible && <p>추첨할 참가자가 없어요.</p>}
            </section>
            <h2>당첨 이력</h2>
            {!event.draws.length && <p>아직 당첨자가 없어요.</p>}
            <ul>
              {event.draws.filter((d) => d.seq <= printed).map((d) => (
                <li key={d.seq}>
                  <span>{d.seq}회차</span>
                  <strong>{numberLabel(d.num)}번</strong>
                </li>
              ))}
            </ul>
          </>
        )}
        <footer>
          <button
            disabled={disabled}
            onClick={() => {
              if (
                confirm(
                  "행사를 종료할까요? 이후 입장, 질문, 배정과 추첨이 마감됩니다.",
                )
              )
                void run(() => operate("end", {}));
            }}
          >
            행사 종료
          </button>
        </footer>
      </main>
    </>
  );
}
