-- Round publication locks the event before writing seats. Use the same lock
-- order while preserving the cards already visible to seated participants.
select singleton from bam.event for update;
alter table bam.seats add column card_id integer references bam.cards(id);
update bam.seats s set card_id = c.id
from bam.cards c
where c.id = 1 + mod(s.round_no + s.room - 2, nullif((select count(*)::int from bam.cards), 0));

create function bam.deal_round_cards() returns trigger
language plpgsql set search_path = '' as $$
declare
  table_num integer;
  chosen_card integer;
begin
  for table_num in
    select room from bam.seats where round_no = new.round_no
    group by room order by random()
  loop
    select c.id into chosen_card
    from bam.cards c
    order by
      (select count(distinct dealt.room) from bam.seats dealt
       where dealt.round_no = new.round_no and dealt.card_id = c.id),
      (select count(*) from bam.seats past
       join bam.seats present on present.num = past.num
       where present.round_no = new.round_no and present.room = table_num
         and past.round_no < new.round_no and past.card_id = c.id),
      random()
    limit 1;

    update bam.seats set card_id = chosen_card
    where round_no = new.round_no and room = table_num;
  end loop;
  return new;
end $$;

create trigger deal_round_cards after update of round_no on bam.event
for each row when (new.round_no > old.round_no)
execute function bam.deal_round_cards();

create or replace function public.event_state(host_view boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception '참여 세션이 필요합니다.'; end if;
  if host_view and not exists(select from bam.hosts where owner=auth.uid()) then raise exception '비공개 운영 링크가 필요합니다.'; end if;
  select jsonb_build_object('title',e.title,'round',e.round_no,'open',e.questions_open,'ended',e.ended,
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
