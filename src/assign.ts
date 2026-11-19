import type { Staff, Table } from "./event";

function pair(a: number, b: number) {
  return Math.min(a, b) + "/" + Math.max(a, b);
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
  const ratio =
    members.filter((m) => m.cohort === "OB").length / members.length;
  let bestRepeat = Infinity,
    bestMix = Infinity;
  let best: { num: number; room: number }[] = [];
  for (let attempt = 0; attempt < 96; attempt++) {
    const order = [...members];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const seats = used.map((table) => ({ table, nums: [] as number[], ob: 0 }));
    let repeats = 0;
    for (const member of order) {
      const available = seats.filter((s) => s.nums.length < s.table.capacity);
      const score = (s: (typeof seats)[number]) => {
        const repeat = s.nums.reduce(
          (sum, n) => sum + (encounters.get(pair(n, member.num)) ?? 0),
          0,
        );
        const deviation = Math.abs(
          s.ob + Number(member.cohort === "OB") - (s.nums.length + 1) * ratio,
        );
        return { repeat, deviation };
      };
      available.sort(
        (a, b) =>
          a.nums.length - b.nums.length ||
          score(a).repeat - score(b).repeat ||
          score(a).deviation - score(b).deviation,
      );
      const chosen = available[0];
      repeats += score(chosen).repeat;
      chosen.nums.push(member.num);
      chosen.ob += Number(member.cohort === "OB");
    }
    const mix = seats.reduce(
      (sum, s) => sum + Math.abs(s.ob - s.nums.length * ratio),
      0,
    );
    if (repeats < bestRepeat || (repeats === bestRepeat && mix < bestMix)) {
      bestRepeat = repeats;
      bestMix = mix;
      best = seats.flatMap((s) =>
        s.nums.map((num) => ({ num, room: s.table.num })),
      );
      if (!mix && !repeats) break;
    }
  }
  return best;
}
