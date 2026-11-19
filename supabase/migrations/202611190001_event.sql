create schema bam;
revoke all on schema bam from public, anon, authenticated;

-- The pilot has a single pre-registered event. Its private tables are never exposed by PostgREST.
create table bam.event (
  singleton boolean primary key default true check (singleton),
  title text not null,
  round_no integer not null default 0,
  questions_open boolean not null default false,
  ended boolean not null default false,
  host_hash text
);
insert into bam.event (title) values ('COMP인의 밤');
create table bam.tables (num integer primary key, capacity integer not null check (capacity > 0), directions text not null);
insert into bam.tables values
  (1,4,'입구에서 왼쪽 안쪽 테이블이에요.'),(2,4,'입구에서 오른쪽 안쪽 테이블이에요.'),
  (3,4,'입구에서 왼쪽 테이블이에요.'),(4,4,'입구에서 오른쪽 테이블이에요.');
create table bam.members (
  num integer generated always as identity primary key, owner uuid unique not null,
  cohort text not null check (cohort in ('OB','YB')), active boolean not null default true
);
create table bam.hosts (owner uuid primary key);
create table bam.seats (
  round_no integer not null, num integer not null references bam.members,
  room integer not null references bam.tables, primary key (round_no,num)
);
create table bam.cards (id integer primary key, prompt text not null);
insert into bam.cards values
  (1,'동아리에서 다시 해보고 싶은 활동이 하나 있다면요?'),
  (2,'처음 동아리방에 들어간 날, 무엇이 가장 기억나나요?'),
  (3,'같이 만들어 보고 싶은 작은 프로젝트가 있나요?'),
  (4,'다른 기수에게 꼭 소개하고 싶은 동아리 전통은 무엇인가요?'),
  (5,'올해 처음 해본 일 중 가장 재미있었던 건 무엇인가요?');
create table bam.questions (
  id uuid primary key, body text not null check (length(trim(body)) between 1 and 500),
  state text not null default 'pending' check (state in ('pending','answered','hidden')),
  created timestamptz not null default now()
);
create table bam.draws (seq integer primary key, num integer unique not null references bam.members);

create function public.claim_host(secret text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from bam.event where host_hash = encode(sha256(convert_to(secret,'UTF8')),'hex')) then
    raise exception '운영 링크를 확인해 주세요.';
  end if;
  insert into bam.hosts values (auth.uid()) on conflict do nothing;
end $$;

create function public.event_state(host_view boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception '참여 세션이 필요합니다.'; end if;
  if host_view and not exists(select from bam.hosts where owner=auth.uid()) then raise exception '비공개 운영 링크가 필요합니다.'; end if;
  select jsonb_build_object('title',e.title,'round',e.round_no,'open',e.questions_open,'ended',e.ended,
    'tables',(select jsonb_agg(to_jsonb(t) order by num) from bam.tables t),
    'me',(select jsonb_build_object('num',m.num,'cohort',m.cohort,'active',m.active,'room',s.room,'card',
      (select prompt from bam.cards where id=1+mod(e.round_no+s.room-2,(select count(*)::int from bam.cards))))
      from bam.members m left join bam.seats s on s.num=m.num and s.round_no=e.round_no where m.owner=auth.uid()),
    'draws',coalesce((select jsonb_agg(to_jsonb(d) order by seq desc) from bam.draws d),'[]'::jsonb))
    into result from bam.event e;
  if host_view then
    result := result || jsonb_build_object('staff',jsonb_build_object(
      'members',coalesce((select jsonb_agg(jsonb_build_object('num',num,'cohort',cohort,'active',active) order by num) from bam.members),'[]'::jsonb),
      'history',coalesce((select jsonb_agg(to_jsonb(s) order by round_no,num) from bam.seats s),'[]'::jsonb),
      'questions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'state',state) order by created) from bam.questions),'[]'::jsonb)));
  end if;
  return result;
end $$;

create function public.check_in(cohort text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from bam.event for update;
  if auth.uid() is null then raise exception '참여 세션이 필요합니다.'; end if;
  if exists(select from bam.members where owner=auth.uid()) then return; end if;
  if (select ended from bam.event) then raise exception '종료된 행사입니다.'; end if;
  insert into bam.members(owner,cohort) values (auth.uid(),$1);
end $$;

create function public.send_question(request_id uuid, body text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from bam.event for update;
  if not exists(select from bam.members where owner=auth.uid() and active) then raise exception '입장 후 이용해 주세요.'; end if;
  if exists(select from bam.questions where id=request_id) then return; end if;
  if not (select questions_open and not ended from bam.event) then raise exception '질문 접수가 마감되었어요.'; end if;
  insert into bam.questions(id,body) values (request_id,trim(body));
end $$;

create function public.host_action(action text, payload jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare e bam.event; assigned integer; active_count integer; winner integer; previous integer;
begin
  if not exists(select from bam.hosts where owner=auth.uid()) then raise exception '운영 권한이 필요합니다.'; end if;
  select * into strict e from bam.event for update;
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

revoke all on function public.claim_host(text), public.event_state(boolean), public.check_in(text),
  public.send_question(uuid,text), public.host_action(text,jsonb) from public, anon;
grant execute on function public.claim_host(text), public.event_state(boolean), public.check_in(text),
  public.send_question(uuid,text), public.host_action(text,jsonb) to authenticated;
