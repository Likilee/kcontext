INSERT INTO video (id, title, channel_name, published_at, audio_language_code) VALUES
  ('test_video_01', '테스트 영상 1: 일상 대화', '테스트 채널', '2024-06-15T00:00:00Z', 'ko'),
  ('test_video_02', '테스트 영상 2: 뉴스 리포트', '뉴스 채널', '2024-07-20T00:00:00Z', 'ko'),
  ('test_video_03', '테스트 영상 3: 요리 방송', '요리 채널', '2024-08-10T00:00:00Z', 'ko')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subtitle (video_id, start_time, text) VALUES
  ('test_video_01', 0.0, '안녕하세요 여러분'),
  ('test_video_01', 2.5, '오늘은 정말 좋은 날씨네요'),
  ('test_video_01', 5.1, '진짜 행복해요'),
  ('test_video_01', 7.8, '그럼 시작해 볼까요'),
  ('test_video_02', 0.0, '오늘의 뉴스를 전해드리겠습니다'),
  ('test_video_02', 3.2, '한국 경제가 성장하고 있습니다'),
  ('test_video_02', 6.5, '다음 소식입니다'),
  ('test_video_03', 0.0, '안녕하세요 오늘은 김치찌개를 만들어 볼게요'),
  ('test_video_03', 4.0, '먼저 재료를 준비해 주세요'),
  ('test_video_03', 8.0, '진짜 맛있어요');
