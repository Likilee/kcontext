## 1. **데이터베이스 스키마 및 무결성 전략**

### 1.1 Schema DDL (Supabase PostgreSQL)

```sql
-- PGroonga 확장 활성화
CREATE EXTENSION IF NOT EXISTS pgroonga;

-- 비디오 메타데이터 테이블
CREATE TABLE video (
    id TEXT PRIMARY KEY,
    title TEXT,
    channel_name TEXT,
    published_at TIMESTAMPTZ,
    audio_language_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 검색 전용 자막 테이블 (외래키 결합 없는 1회성 인덱스)
CREATE TABLE subtitle (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    video_id TEXT NOT NULL REFERENCES video(id) ON DELETE CASCADE,
    start_time REAL NOT NULL,
    text TEXT NOT NULL -- 검색용 정제 텍스트. 실제 재생 원문은 Storage JSON 사용
);

-- PGroonga 인덱스 생성
CREATE INDEX idx_subtitle_text_pgroonga ON subtitle USING pgroonga (text);
CREATE INDEX idx_subtitle_video_id ON subtitle (video_id);
```

### 1.2 Search RPC (Stored Procedure)

```sql
CREATE OR REPLACE FUNCTION search_subtitles(search_keyword TEXT, audio_language_code TEXT)
RETURNS TABLE (
  video_id TEXT, title TEXT, channel_name TEXT, start_time REAL, text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id AS video_id, v.title, v.channel_name, s.start_time, s.text
  FROM subtitle s
  JOIN video v ON s.video_id = v.id
  WHERE s.text &@ search_keyword
    AND v.audio_language_code = search_subtitles.audio_language_code
  ORDER BY v.published_at DESC LIMIT 50;
END;
$$ LANGUAGE plpgsql;
```

`subtitle.text` 는 원문 자막 복제본이 아니라 검색 인덱스용 정제 텍스트다. 소괄호/대괄호 문맥 메모를 제거한 값만 저장하며, 실제 플레이어/청크 뷰어는 Storage 의 전체 자막 JSON 원문을 사용한다.
