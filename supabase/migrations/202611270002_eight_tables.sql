insert into bam.tables (num, capacity, directions) values
  (1, 4, '입구에서 가장 먼 줄의 왼쪽 테이블이에요.'),
  (2, 4, '입구에서 가장 먼 줄의 오른쪽 테이블이에요.'),
  (3, 4, '입구에서 세 번째 줄의 왼쪽 테이블이에요.'),
  (4, 4, '입구에서 세 번째 줄의 오른쪽 테이블이에요.'),
  (5, 4, '입구에서 두 번째 줄의 왼쪽 테이블이에요.'),
  (6, 4, '입구에서 두 번째 줄의 오른쪽 테이블이에요.'),
  (7, 4, '입구에서 가장 가까운 줄의 왼쪽 테이블이에요.'),
  (8, 4, '입구에서 가장 가까운 줄의 오른쪽 테이블이에요.')
on conflict (num) do update
set capacity = excluded.capacity, directions = excluded.directions;
