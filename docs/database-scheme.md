## 1. **데이터베이스 스키마 및 무결성 전략**

### 1.1 Schema DDL (Supabase PostgreSQL)

```sql
-- PGroonga 확장 활성화
CREATE EXTENSION IF NOT EXISTS pgroonga;

-- 비디오 메타데이터 테이블
CREATE TABLE video (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 검색 전용 자막 테이블 (외래키 결합 없는 1회성 인덱스)
CREATE TABLE subtitle (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    video_id TEXT NOT NULL REFERENCES video(id) ON DELETE CASCADE,
    start_time REAL NOT NULL,
    text TEXT NOT NULL
);

-- PGroonga 인덱스 생성
CREATE INDEX idx_subtitle_text_pgroonga ON subtitle USING pgroonga (text);
CREATE INDEX idx_subtitle_video_id ON subtitle (video_id);
```

### 1.2 Search RPC (Stored Procedure)

```sql
CREATE OR REPLACE FUNCTION search_subtitles(search_keyword TEXT)
RETURNS TABLE (
  video_id TEXT, title TEXT, channel_name TEXT, start_time REAL, text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id AS video_id, v.title, v.channel_name, s.start_time, s.text
  FROM subtitle s
  JOIN video v ON s.video_id = v.id
  WHERE s.text &@ search_keyword
  ORDER BY v.published_at DESC LIMIT 50;
END;
$$ LANGUAGE plpgsql;
```