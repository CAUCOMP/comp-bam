create or replace function public.reset_event(expected_generation integer, expected_counts jsonb)
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

  truncate table bam.seats, bam.draws, bam.questions, bam.members restart identity restrict;
  update bam.event set generation = generation + 1, round_no = 0,
    questions_open = false, ended = false where singleton;
end $$;
