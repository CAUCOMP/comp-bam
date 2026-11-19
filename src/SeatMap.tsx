import { numberLabel } from "./event";
import type { Table } from "./event";

export function SeatMap({
  tables,
  current,
}: {
  tables: Table[];
  current?: number | null;
}) {
  return (
    <figure
      className="map"
      aria-label={
        current ? `배치도, 내 자리 ${current}번 테이블` : "행사장 테이블 배치도"
      }
    >
      <div className="floor">
        {tables.map((t) => (
          <div
            className={"table-symbol" + (current === t.num ? " selected" : "")}
            key={t.num}
          >
            <div className="chairs" aria-hidden="true">
              <i />
              <i />
            </div>
            <strong>{numberLabel(t.num, 2)}</strong>
            <div className="chairs" aria-hidden="true">
              <i />
              <i />
            </div>
          </div>
        ))}
      </div>
      <figcaption>출입구</figcaption>
    </figure>
  );
}
