-- A null cohort identifies a question sent using the original, host-only form.
alter table bam.questions add column cohort text check (cohort in ('OB','YB'));

-- Older clients can continue sending host-only questions through send_question.
create function public.send_public_question(request_id uuid, body text)
returns void language plpgsql security definer set search_path = '' as $$
declare author_cohort text;
begin
  perform 1 from bam.event for update;
  select cohort into author_cohort from bam.members where owner = auth.uid() and active;
  if not found then raise exception '입장 후 이용해 주세요.'; end if;
  if exists(select from bam.questions where id = request_id) then return; end if;
  if not (select questions_open and not ended from bam.event) then
    raise exception '질문 접수가 마감되었어요.';
  end if;
  insert into bam.questions(id,body,cohort) values (request_id,trim(body),author_cohort);
end $$;

revoke all on function public.send_public_question(uuid,text) from public, anon;
grant execute on function public.send_public_question(uuid,text) to authenticated;

create or replace function public.event_state(host_view boolean default false) returns jsonb
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
    'questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'body',body,'state',state,'cohort',cohort) order by created desc,id)
      from bam.questions where cohort is not null and state in ('pending','answered')
    ),'[]'::jsonb),
    'draws',coalesce((select jsonb_agg(to_jsonb(d) order by seq desc) from bam.draws d),'[]'::jsonb))
    into result from bam.event e;
  if host_view then
    result := result || jsonb_build_object('staff',jsonb_build_object(
      'members',coalesce((select jsonb_agg(jsonb_build_object('num',num,'cohort',cohort,'active',active) order by num) from bam.members),'[]'::jsonb),
      'history',coalesce((select jsonb_agg(to_jsonb(s) order by round_no,num) from bam.seats s),'[]'::jsonb),
      'questions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'state',state,'cohort',cohort) order by created) from bam.questions),'[]'::jsonb)));
  end if;
  return result;
end $$;
