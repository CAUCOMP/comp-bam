insert into bam.tables (num, capacity, directions) values
  (1, 5, '입구에서 가장 먼 줄의 왼쪽 테이블이에요.'),
  (2, 5, '입구에서 가장 먼 줄의 오른쪽 테이블이에요.'),
  (3, 5, '가운데 줄의 왼쪽 테이블이에요.'),
  (4, 5, '가운데 줄의 오른쪽 테이블이에요.'),
  (5, 5, '입구에서 가장 가까운 줄의 왼쪽 테이블이에요.'),
  (6, 5, '입구에서 가장 가까운 줄의 오른쪽 테이블이에요.')
on conflict (num) do update
set capacity = excluded.capacity, directions = excluded.directions;
