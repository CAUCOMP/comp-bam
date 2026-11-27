import assert from "node:assert/strict";
import test from "node:test";
import { assign } from "../src/assign.ts";

const tables = [1, 2].map((num) => ({ num, capacity: 4, directions: "" }));
const members = Array.from({ length: 8 }, (_, i) => ({
  num: i + 1,
  cohort: i < 6 ? "OB" : "YB",
  active: true,
}));
const staff = { members, history: [], questions: [] };

test("balances seats and the two cohorts, then reduces repeat meetings", () => {
  const first = assign(staff, tables);
  assert.equal(new Set(first.map((s) => s.num)).size, 8);
  for (const table of tables) {
    const seats = first.filter((s) => s.room === table.num);
    assert.equal(seats.length, 4);
    assert.equal(seats.filter((s) => s.num > 6).length, 1);
  }
  const next = assign(
    { ...staff, history: first.map((s) => ({ ...s, round_no: 1 })) },
    tables,
  );
  for (const table of tables) {
    const nums = new Set(
      next.filter((s) => s.room === table.num).map((s) => s.num),
    );
    assert.equal(
      first.filter((s) => s.room === 1 && nums.has(s.num)).length,
      2,
    );
  }
});

test("uses the active roster at round start and rejects insufficient capacity", () => {
  const changed = {
    ...staff,
    members: [
      { ...members[0], active: false },
      ...members.slice(1),
      { num: 9, cohort: "OB", active: true },
    ],
  };
  const seats = assign(changed, tables);
  assert.ok(seats.some((s) => s.num === 9));
  assert.ok(!seats.some((s) => s.num === 1));
  assert.throws(() => assign(changed, tables.slice(0, 1)), /4개/);
  assert.throws(() => assign({ ...staff, members: [] }, tables), /없어요/);
});
test("two people share one table", () => {
  const seats = assign({ ...staff, members: members.slice(0, 2) }, tables);
  assert.equal(seats[0].room, seats[1].room);
});

test("spreads OB across eight tables even when meeting history favors grouping them", () => {
  const rooms = Array.from({ length: 8 }, (_, i) => ({ num: i + 1, capacity: 4, directions: "" }));
  for (const obCount of [3, 8, 10]) {
    const roster = Array.from({ length: 30 }, (_, i) => ({
      num: i + 1, cohort: i < obCount ? "OB" : "YB", active: true,
    }));
    // Each OB has previously shared a table with every YB.
    const history = [];
    for (const ob of roster.slice(0, obCount)) {
      for (const yb of roster.slice(obCount)) {
        const round_no = history.length / 2 + 1;
        history.push({ num: ob.num, room: 1, round_no }, { num: yb.num, room: 1, round_no });
      }
    }
    const plan = assign({ ...staff, members: roster, history }, rooms);
    assert.deepEqual(plan.map(s => s.num).sort((a, b) => a - b), roster.map(m => m.num));
    for (const room of rooms) {
      const group = plan.filter(s => s.room === room.num);
      const ob = group.filter(s => s.num <= obCount).length;
      assert.ok(ob === Math.floor(obCount / 8) || ob === Math.ceil(obCount / 8));
      assert.ok(group.length === 3 || group.length === 4);
    }
  }
});
