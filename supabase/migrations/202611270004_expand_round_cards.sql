insert into bam.cards (id, prompt) values
  (6, '학교 앞에서 한 끼만 먹을 수 있다면 어디서 뭘 드실래요?'),
  (7, '동아리방에 딱 한 가지를 들여놓을 수 있다면 뭘 고를래요?'),
  (8, '요즘 시간 가는 줄 모르고 하는 일이 뭐예요?'),
  (9, '내일 갑자기 하루가 빈다면 뭘 하면서 보내고 싶어요?'),
  (10, '내 플레이리스트에서 이 테이블에 한 곡 들려준다면 어떤 곡이에요?'),
  (11, '처음 만난 사람하고 금방 친해졌던 계기가 있나요?'),
  (12, '다른 기수 동아리방에 하루 놀러 간다면 뭐가 제일 궁금해요?'),
  (13, '누가 알려줘서 아직도 잘 써먹는 작은 요령이 있나요?'),
  (14, '최근에 친구한테 추천하고 반응이 좋았던 건 뭐예요?'),
  (15, '캠퍼스에서 산책 코스를 하나 추천한다면 어디를 걷고 싶어요?'),
  (16, '지금 이 테이블 사람들과 번개 모임을 연다면 뭘 같이 해보고 싶어요?'),
  (17, '전공과 상관없이 수업을 하나 청강할 수 있다면 뭘 들어보고 싶어요?'),
  (18, '동아리방 문 앞에 걸어둘 한 줄 문구를 같이 짓는다면 뭐라고 쓸까요?');

create or replace function bam.deal_round_cards() returns trigger
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
      exists (select from bam.seats prev where prev.round_no = old.round_no
              and prev.room = table_num and prev.card_id = c.id),
      (select count(distinct dealt.room) from bam.seats dealt
       where dealt.round_no = new.round_no and dealt.card_id = c.id),
      exists (select from bam.seats prev where prev.round_no = old.round_no
              and prev.card_id = c.id),
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
