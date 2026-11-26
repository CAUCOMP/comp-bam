import { numberLabel } from "./event";
import type { Table } from "./event";

function Chairs({ count }: { count: number }) {
  return (
    <div className="chairs" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <i key={index} />)}
    </div>
  );
}

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
            <Chairs count={Math.ceil(t.capacity / 2)} />
            <strong>{numberLabel(t.num, 2)}</strong>
            <Chairs count={Math.floor(t.capacity / 2)} />
          </div>
        ))}
      </div>
      <figcaption>출입구</figcaption>
    </figure>
  );
}
