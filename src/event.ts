import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const cohort = z.enum(["OB", "YB"]);
const member = z.object({ num: z.number(), cohort, active: z.boolean() });
const seat = z.object({
  num: z.number(),
  room: z.number(),
  round_no: z.number(),
});
const publicQuestion = z.object({
  id: z.string(),
  body: z.string(),
  state: z.enum(["pending", "answered"]),
  cohort,
});
const staffQuestion = publicQuestion.extend({
  state: z.enum(["pending", "answered", "hidden"]),
  cohort: cohort.nullable(),
});
const table = z.object({
  num: z.number(),
  capacity: z.number(),
  directions: z.string(),
});
const snapshot = z.object({
  title: z.string(),
  round: z.number(),
  open: z.boolean(),
  ended: z.boolean(),
  tables: z.array(table),
  questions: z.array(publicQuestion),
  draws: z.array(z.object({ seq: z.number(), num: z.number() })),
  me: member
    .extend({ room: z.number().nullable(), card: z.string().nullable() })
    .nullable(),
  staff: z
    .object({
      members: z.array(member),
      history: z.array(seat),
      questions: z.array(staffQuestion),
    })
    .optional(),
});
export type EventState = z.infer<typeof snapshot>;
export type Staff = NonNullable<EventState["staff"]>;
export type Cohort = z.infer<typeof cohort>;
export type Table = z.infer<typeof table>;
export const numberLabel = (num: number, digits = 3) =>
  String(num).padStart(digits, "0");
export const hostPage = location.pathname.replace(/\/$/, "") === "/admin";
const hostSecret = new URLSearchParams(location.hash.slice(1)).get("key");
const endpoint = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client =
  endpoint && key
    ? createClient(new URL(endpoint, location.origin).href, key)
    : null;

async function rpc(name: string, args: Record<string, unknown>) {
  if (!client)
    throw new Error(
      "Supabase 연결 설정이 필요합니다. 로컬에서는 npm run local:start를 실행해 주세요.",
    );
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

let initialized: Promise<void> | undefined;
async function connect() {
  if (!client)
    throw new Error(
      "Supabase 연결 설정이 필요합니다. 로컬에서는 npm run local:start를 실행해 주세요.",
    );
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const login = await client.auth.signInAnonymously();
    if (login.error) throw login.error;
  }
  if (hostPage && hostSecret) {
    await rpc("claim_host", { secret: hostSecret });
    history.replaceState(null, "", location.pathname + location.search);
  }
}

export async function readEvent() {
  initialized ??= connect().catch((error) => {
    initialized = undefined;
    throw error;
  });
  await initialized;
  return snapshot.parse(await rpc("event_state", { host_view: hostPage }));
}
export const checkIn = (value: Cohort) => rpc("check_in", { cohort: value });
export const sendQuestion = (id: string, body: string) =>
  rpc("send_public_question", { request_id: id, body });
type Commands = {
  round: { expected: number; seats: { num: number; room: number }[] };
  draw: { expected: number };
  reception: { open: boolean };
  end: Record<string, never>;
  moderate: { id: string; state: "answered" | "hidden" };
  depart: { num: number };
};
export const operate = <K extends keyof Commands>(
  action: K,
  payload: Commands[K],
) => rpc("host_action", { action, payload });
