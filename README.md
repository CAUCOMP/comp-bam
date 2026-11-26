# COMP인의 밤

COMP 동문 행사 한 회를 진행하는 모바일 웹이다. 참가자는 QR로 들어와 OB/YB를 선택하고, 라운드별 테이블 위치와 대화 카드, 익명 질문, 추첨 결과를 같은 페이지에서 확인한다. 운영진은 비공개 링크로 입장한다.

## 로컬에서 실행하기

Node.js 22.12 이상과 Docker가 필요하다. 프로젝트 루트에서 실행한다.

```sh
npm ci
npm run local:start
npm run dev:local
```

참가자 주소는 `http://localhost:5173/`다. 시작 스크립트가 출력하는 `/admin#key=…` 링크로 운영 화면을 연다. 비공개 링크는 처음 연 브라우저의 익명 세션에 운영 권한을 부여하고 주소창에서 키를 지운다. 참가용 QR과 운영 링크를 구분해 배포한다.

휴대폰에서는 같은 Wi-Fi에 연결하고 Vite가 표시하는 Network 주소를 사용한다. 운영 링크도 호스트를 같은 Network 주소로 바꿔 열면 QR이 휴대폰에서 열 수 있는 참가자 주소를 가리킨다. 로컬 개발 서버가 Supabase 요청을 프록시한다. 인터넷에 공개할 때는 HTTPS를 사용한다.

작업을 마치면 Vite를 종료하고 `npm run local:stop`을 실행한다. 다음 시작 시 데이터와 운영 키가 복원된다. 개발용 DB와 API 포트는 각각 55432와 55431이다.

## 첫 행사 설정

마이그레이션을 적용하면 **COMP인의 밤**에 5인 테이블 6개, 총 30석이 등록된다. 출입구에서 안쪽을 바라봤을 때 01·02는 가장 먼 줄, 03·04는 가운데 줄, 05·06은 입구 쪽이다. 각 줄에서 홀수 번호는 왼쪽, 짝수 번호는 오른쪽이다. 행사 전에 실제 배치와 위치 안내가 일치하는지 확인한다. 기본 질문 접수는 닫혀 있으며 운영진이 현장에서 연다.

테이블 배정은 활성 명단을 사용한다. 현재 배정은 고정하고 다음 라운드를 만들 때 지각·퇴장자를 반영한다. 운영자 브라우저가 인원 균형, 이전 동석 이력, OB/YB 분산을 고려해 후보를 계산한다. DB가 명단과 정원을 다시 검증한 뒤 한 트랜잭션으로 공개한다. 추첨도 DB에서 한 명씩 확정한다. 브라우저는 약 4초마다, 그리고 화면으로 복귀할 때 상태를 다시 읽는다.

## 호스팅 Supabase에 연결하기

1. Supabase 프로젝트에서 Anonymous Sign-Ins를 활성화한다. 예상 동시 입장자 수와 행사장 공용 Wi-Fi를 고려해 익명 인증 요청 제한을 확인한다.
2. 로컬 CLI를 해당 프로젝트에 연결한 후 `npx supabase db push --remote`로 마이그레이션을 적용한다.
3. SQL Editor에서 아래 쿼리를 한 번 실행해 운영 링크용 키를 발급한다. 결과의 키를 복사해 `https://배포주소/admin#key=발급값`으로 운영진에게 전달한다.

   ```sql
   with secret as materialized (
     select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as value
   )
   update bam.event
   set host_hash = encode(sha256(convert_to(secret.value, 'UTF8')), 'hex')
   from secret where singleton
   returning secret.value;
   ```

4. `.env.example`을 참고해 배포 환경에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`를 지정한다. 브라우저에는 publishable key만 넣는다. `npm run build`가 생성한 `dist/`를 정적 호스팅하고 `/admin` 직접 접근 시 `index.html`을 제공하도록 설정한다.

키를 다시 발급하면 이전 초대 링크가 무효화된다. 기존 브라우저의 운영 권한을 회수하려면 SQL Editor에서 해당 세션의 `bam.hosts` 행도 삭제한다.

### Vercel로 프론트 배포하기

1. `CAUCOMP/comp-bam`의 `main`에 푸시하면 연결된 Vercel 프로젝트 `tony-ef78/comp-bam`이 Vite 빌드를 시작한다. 빌드가 성공하면 [운영 사이트](https://comp-bam.vercel.app/)에 반영된다.
2. 프로덕션 브랜치를 `main`, 프로젝트 루트를 저장소 루트, 빌드 명령을 `npm run build`, 출력 디렉토리를 `dist`로 지정한다. Node.js는 프로젝트의 로컬 실행 요건에 맞춘다.
3. 첫 빌드 전에 Production 환경에 위 두 `VITE_` 값을 등록한다. URL에는 호스팅 Supabase의 HTTPS 프로젝트 주소를 사용한다. 환경값을 바꾸면 다시 빌드한다.
4. 배포된 HTTPS 주소의 `/admin`에 운영 링크로 접속해 참가용 QR을 연다. QR은 현재 사이트 주소에서 생성된다. 휴대폰의 Wi-Fi를 끄고 QR로 접속해 체크인한 뒤 운영 화면에 인원이 반영되는지 확인한다.

`vercel.json`은 운영 링크의 `/admin` 요청을 `/index.html`로 연결한다. Git 저장소 연동 시 프론트 변경은 자동으로 재배포되고, DB 변경은 호스팅 프로젝트에 `npx supabase db push --remote`로 별도 적용한다. [Vercel의 Vite 배포 문서](https://vercel.com/docs/frameworks/frontend/vite)

## 검증

`npm test`는 테이블 배정의 정원·인원 균형·재회·OB/YB 분산과 지각·퇴장 시나리오를 확인한다. `npm run build`는 타입 검사와 배포 빌드를 실행한다. 현장 리허설에는 [PRD](PRD.md)의 시나리오를 사용한다.
