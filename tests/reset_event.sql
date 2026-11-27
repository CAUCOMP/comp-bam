-- Run as postgres on a disposable Supabase DB after applying all migrations.
-- Match the statement guard enabled for hosted API requests.
load 'safeupdate';
begin;
alter table bam.members alter column num restart with 1;
insert into bam.hosts(owner) values ('00000000-0000-4000-8000-000000000001');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.check_in('OB');
do $$
begin
  perform public.reset_event(0, '{"members":1,"rounds":0,"draws":0,"questions":0}');
  raise exception 'ordinary participant reset the event';
exception when raise_exception then
  if sqlerrm <> '운영 권한이 필요합니다.' then raise; end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
select public.check_in('YB');
select public.host_action('round','{"expected":0,"seats":[{"num":1,"room":1},{"num":2,"room":1}]}');
select public.host_action('draw','{"expected":0}');
select public.host_action('reception','{"open":true}');
select public.send_public_question(gen_random_uuid(),'test question');
select public.host_action('depart','{"num":1}');
select public.host_action('end','{}');
do $$
declare
  counts jsonb := '{"members":2,"rounds":1,"draws":1,"questions":1}';
  before_reset jsonb := public.event_state(true);
  after_reset jsonb;
begin
  begin
    perform public.reset_event(0,counts || '{"members":1}');
    raise exception 'accepted outdated counts';
  exception when raise_exception then
    if sqlerrm <> '삭제할 기록 수가 바뀌었어요. 다시 확인해 주세요.' then raise; end if;
  end;
  assert before_reset = public.event_state(true);
  perform public.reset_event(0,counts);
  after_reset := public.event_state(true);
  assert after_reset @> '{"generation":1,"round":0,"ended":false,"open":false,"me":null}';
  assert after_reset->'staff' = '{"members":[],"history":[],"questions":[]}'::jsonb;
  assert after_reset->'draws' = '[]' and after_reset->'questions' = '[]';
  assert after_reset->'tables' = before_reset->'tables';
  perform public.check_in('OB');
  begin
    perform public.reset_event(0,counts);
    raise exception 'retried reset accepted';
  exception when raise_exception then
    if sqlerrm <> '이미 초기화된 행사입니다. 현재 상태를 확인해 주세요.' then raise; end if;
  end;
  begin
    perform public.host_action('depart','{"num":1,"generation":0}');
    raise exception 'stale host command accepted';
  exception when raise_exception then
    if sqlerrm <> '행사가 초기화되었어요. 페이지를 새로고침해 주세요.' then raise; end if;
  end;
  assert public.event_state(true)->'me' @> '{"num":1,"active":true}';
  perform public.host_action('round','{"generation":1,"expected":0,"seats":[{"num":1,"room":1}]}');
  assert public.event_state(true)#>>'{me,card}' is not null;
  perform public.reset_event(1,'{"members":1,"rounds":1,"draws":0,"questions":0}');
  assert public.event_state(true)->>'generation' = '2';
end $$;
rollback;
