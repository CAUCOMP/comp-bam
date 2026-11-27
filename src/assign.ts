import type { Staff, Table } from "./event";

function pair(a: number, b: number) {
  return Math.min(a, b) + "/" + Math.max(a, b);
}

function shuffled<T>(items: T[]) {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function assign(staff: Staff, tables: Table[]) {
  const members = staff.members.filter((m) => m.active);
  if (!members.length) throw new Error("배정할 참가자가 없어요.");
  const capacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  if (capacity < members.length)
    throw new Error(`좌석 ${members.length - capacity}개가 더 필요해요.`);
  const used = [...tables].sort(
    (a, b) => b.capacity - a.capacity || a.num - b.num,
  );
  // Avoid seating a lone person at a separate table when the group fits together.
  while (
    used.length > Math.max(1, Math.floor(members.length / 2)) &&
    used.slice(0, -1).reduce((sum, t) => sum + t.capacity, 0) >= members.length
  )
    used.pop();
  const encounters = new Map<string, number>();
  const groups = new Map<string, number[]>();
  for (const seat of staff.history) {
    const key = seat.round_no + "/" + seat.room;
    const group = groups.get(key) ?? [];
    for (const num of group) {
      const ids = pair(num, seat.num);
      encounters.set(ids, (encounters.get(ids) ?? 0) + 1);
    }
    group.push(seat.num);
    groups.set(key, group);
  }
  const ob = members.filter((m) => m.cohort === "OB");
  const yb = members.filter((m) => m.cohort === "YB");
  let bestRepeat = Infinity;
  let best: { num: number; room: number }[] = [];
  for (let attempt = 0; attempt < 96; attempt++) {
    const seats = shuffled(used).map((table) => {
      const nums: number[] = [];
      return { table, nums, yb: 0 };
    });
    let repeats = 0;
    // Seat OB first so a repeat encounter can never force two OB together
    // while another available table has fewer OB.
    for (const member of [...shuffled(ob), ...shuffled(yb)]) {
      const [chosen] = seats
        .filter((s) => s.nums.length < s.table.capacity)
        .map((seat) => ({
          seat,
          repeat: seat.nums.reduce(
            (sum, n) => sum + (encounters.get(pair(n, member.num)) ?? 0), 0,
          ),
        }))
        .sort((a, b) =>
          a.seat.nums.length - b.seat.nums.length ||
          a.seat.yb - b.seat.yb ||
          a.repeat - b.repeat,
        );
      repeats += chosen.repeat;
      chosen.seat.nums.push(member.num);
      if (member.cohort === "YB") chosen.seat.yb++;
    }
    if (repeats < bestRepeat) {
      bestRepeat = repeats;
      best = seats.flatMap((s) =>
        s.nums.map((num) => ({ num, room: s.table.num })),
      );
      if (!repeats) break;
    }
  }
  return best;
}
