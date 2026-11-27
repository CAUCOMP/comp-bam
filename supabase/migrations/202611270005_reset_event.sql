alter table bam.event add column generation integer not null default 0;

create or replace function public.event_state(host_view boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception '참여 세션이 필요합니다.'; end if;
  if host_view and not exists(select from bam.hosts where owner=auth.uid()) then raise exception '비공개 운영 링크가 필요합니다.'; end if;
  select jsonb_build_object('generation',e.generation,'title',e.title,'round',e.round_no,'open',e.questions_open,'ended',e.ended,
    'tables',(select jsonb_agg(to_jsonb(t) order by num) from bam.tables t),
    'me',(select jsonb_build_object('num',m.num,'cohort',m.cohort,'active',m.active,'room',s.room,'card',
      (select prompt from bam.cards where id=s.card_id))
      from bam.members m left join bam.seats s on s.num=m.num and s.round_no=e.round_no where m.owner=auth.uid()),
    'questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'body',body,'state',state,'cohort',cohort) order by created desc,id)
      from bam.questions where cohort is not null and state in ('pending','answered')
    ),'[]'::jsonb),
    'draws',coalesce((select jsonb_agg(to_jsonb(d) order by seq desc) from bam.draws d),'[]'::jsonb))
    into result from bam.event e;
  if host_view then
    result := result || jsonb_build_object('staff',jsonb_build_object(
      'members',coalesce((select jsonb_agg(jsonb_build_object('num',num,'cohort',cohort,'active',active) order by num) from bam.members),'[]'::jsonb),
      'history',coalesce((select jsonb_agg(jsonb_build_object('round_no',round_no,'num',num,'room',room) order by round_no,num) from bam.seats s),'[]'::jsonb),
      'questions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'state',state,'cohort',cohort) order by created) from bam.questions),'[]'::jsonb)));
  end if;
  return result;
end $$;

create or replace function public.host_action(action text, payload jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare e bam.event; assigned integer; active_count integer; winner integer; previous integer;
begin
  if not exists(select from bam.hosts where owner=auth.uid()) then raise exception '운영 권한이 필요합니다.'; end if;
  select * into strict e from bam.event for update;
  -- Clients loaded before the reset feature belong to generation zero.
  if coalesce((payload->>'generation')::integer, 0) <> e.generation then
    raise exception '행사가 초기화되었어요. 페이지를 새로고침해 주세요.';
  end if;
  if action='end' then update bam.event set ended=true, questions_open=false where singleton; return; end if;
  if e.ended then raise exception '종료된 행사입니다.'; end if;
  case action
    when 'reception' then update bam.event set questions_open=(payload->>'open')::boolean where singleton;
    when 'depart' then update bam.members set active=false where num=(payload->>'num')::int;
    when 'moderate' then update bam.questions set state=payload->>'state' where id=(payload->>'id')::uuid;
    when 'draw' then
      select count(*) into previous from bam.draws;
      if (payload->>'expected')::int is distinct from previous then raise exception '추첨 결과가 갱신되었어요. 이력을 확인해 주세요.'; end if;
      select m.num into winner from bam.members m where active and not exists(select from bam.draws d where d.num=m.num) order by random() limit 1;
      if winner is null then raise exception '추첨 가능한 참가자가 없어요.'; end if;
      insert into bam.draws values (previous+1,winner);
    when 'round' then
      if (payload->>'expected')::int is distinct from e.round_no then raise exception '라운드가 변경되었어요. 새로 확인해 주세요.'; end if;
      select count(*) into active_count from bam.members where active;
      if active_count=0 then raise exception '활성 참가자가 없어요.'; end if;
      insert into bam.seats(round_no,num,room)
        select e.round_no+1,plan.num,plan.room from jsonb_to_recordset(payload->'seats') as plan(num int,room int)
        join bam.members m on m.num=plan.num and m.active;
      get diagnostics assigned = row_count;
      if assigned<>active_count or assigned<>jsonb_array_length(payload->'seats') then raise exception '명단이 바뀌었어요. 다시 배정해 주세요.'; end if;
      if exists(select from bam.seats s join bam.tables t on t.num=s.room where s.round_no=e.round_no+1 group by s.room,t.capacity having count(*)>t.capacity)
        then raise exception '테이블 정원을 초과했어요.'; end if;
      update bam.event set round_no=e.round_no+1 where singleton;
    else raise exception '지원하지 않는 작업입니다.';
  end case;
end $$;

create function public.reset_event(expected_generation integer, expected_counts jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare e bam.event;
begin
  if not exists(select from bam.hosts where owner = auth.uid()) then
    raise exception '운영 권한이 필요합니다.';
  end if;
  select * into strict e from bam.event where singleton for update;
  if expected_generation is distinct from e.generation then
    raise exception '이미 초기화된 행사입니다. 현재 상태를 확인해 주세요.';
  end if;
  if expected_counts is distinct from jsonb_build_object(
    'members', (select count(*) from bam.members),
    'rounds', e.round_no,
    'draws', (select count(*) from bam.draws),
    'questions', (select count(*) from bam.questions)
  ) then
    raise exception '삭제할 기록 수가 바뀌었어요. 다시 확인해 주세요.';
  end if;

  delete from bam.seats;
  delete from bam.draws;
  delete from bam.questions;
  delete from bam.members;
  alter table bam.members alter column num restart with 1;
  update bam.event set generation = generation + 1, round_no = 0,
    questions_open = false, ended = false where singleton;
end $$;

revoke all on function public.reset_event(integer,jsonb) from public, anon;
grant execute on function public.reset_event(integer,jsonb) to authenticated;
