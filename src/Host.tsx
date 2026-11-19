import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { numberLabel, operate } from "./event";
import type { EventState, Staff } from "./event";
import type { Action } from "./main";
import { assign } from "./assign";
import { SeatMap } from "./SeatMap";

type Props = { event: EventState; staff: Staff; run: Action; busy: boolean };
type Panel = "현장 진행";
const panels: Panel[] = ["현장 진행"];

export function Host({ event, staff, run, busy }: Props) {
  const [panel, setPanel] = useState<Panel>("현장 진행");
  const [qr, setQr] = useState(false);
  const active = staff.members.filter((m) => m.active);
  const ob = active.filter((m) => m.cohort === "OB").length;
  const totalSeats = event.tables.reduce((sum, t) => sum + t.capacity, 0);
  const seats = staff.history.filter((s) => s.round_no === event.round);
  const disabled = busy || event.ended;
  const joinUrl = new URL("/", location.origin).href;
  return (
    <>
      <header>
        <div>
          <strong>{event.title}</strong>
          <span className="operator">운영진</span>
        </div>
        <button aria-expanded={qr} onClick={() => setQr(!qr)}>
          {qr ? "QR 닫기" : "참가용 QR"}
        </button>
      </header>
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
          <h1>{panel}</h1>
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
