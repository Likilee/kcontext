# CLI Integration Fixtures

`testing/cli-integration/raw` 아래 fixture는 YouTube fetch 결과를 흉내 낸 가짜 샘플이 아니라,
실서비스 Supabase DB의 `video` 행과 `subtitles/{video_id}.json` 스토리지 객체를
스냅샷한 raw JSON이다.

현재 curated fixture 영상:

- `AYcZSPzAh-8` (`떡볶이`, `소주`)
- `omA_eOp6i6k` (`전분당`, `과징금`)
- `Q21S8nbgcVI` (`죽마고우`, `힙합`)

이 fixture는 외부 YouTube fetch 없이 `build -> push -> web` 경로만 검증하는
통합 테스트에서 사용한다.

갱신:

```bash
./scripts/refresh-cli-integration-fixtures.sh
```

다른 영상 세트로 바꾸고 싶으면 스크립트 안의 `--video-id` 목록만 교체하면 된다.
