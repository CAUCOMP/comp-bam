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

마이그레이션을 적용하면 **COMP인의 밤**에 4인 테이블 8개, 총 32석이 등록된다. 출입구에서 안쪽을 바라봤을 때 가까운 줄부터 07·08, 05·06, 03·04, 01·02 순이다. 각 줄에서 홀수 번호는 왼쪽, 짝수 번호는 오른쪽이다. 행사 전에 실제 배치와 위치 안내가 일치하는지 확인한다. 기본 질문 접수는 닫혀 있으며 운영진이 현장에서 연다.

테이블 배정은 활성 명단을 사용한다. 현재 배정은 고정하고 다음 라운드를 만들 때 지각·퇴장자를 반영한다. 매 라운드에 OB를 사용 중인 테이블에 한 명씩 고르게 나눈 뒤 YB를 배정해 전체 인원도 맞춘다. 이 조건을 만족하는 후보 중 이전에 함께 앉은 횟수가 적은 조합을 고른다. DB가 명단과 정원을 다시 검증한 뒤 한 트랜잭션으로 공개한다. 추첨도 DB에서 한 명씩 확정한다. 브라우저는 약 4초마다, 그리고 화면으로 복귀할 때 상태를 다시 읽는다.

## 행사 초기화

운영진 페이지 하단에서 **행사 초기화**를 누르면 삭제할 참가자, 라운드, 당첨 기록, 익명 질문 수가 표시된다. **기록 삭제하고 초기화**를 누르면 체크인이 다시 열리고 첫 참가번호는 001번이 된다. 질문 접수는 닫힌 상태로 시작한다. 테이블 배치, 대화 카드 목록, 운영진 링크와 기존 운영 권한은 유지된다. 진행 중인 행사와 종료된 행사 모두 초기화할 수 있다.

운영진 세션으로 `POST /rest/v1/rpc/reset_event`를 호출한다. 요청에는 `event_state(true)`에서 확인한 `expected_generation`과 `expected_counts`를 넣는다. 예를 들어 참가자 14명(퇴장자 포함), 2라운드, 당첨 7건, 익명 질문 5건이라면 다음과 같다.

```json
{"expected_generation": 0, "expected_counts": {"members": 14, "rounds": 2, "draws": 7, "questions": 5}}
```

확인 이후 건수가 바뀌거나 다른 운영자가 먼저 초기화하면 API가 요청을 거절한다. 최신 현황을 확인하고 다시 요청한다. 초기화 이후 `host_action` 요청은 현재 `generation`을 `payload`에 포함한다.

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
