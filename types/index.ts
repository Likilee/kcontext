export interface VocabularyItem {
  korean: string;
  english: string;
  romanization: string;
}

export interface Transcript {
  timeStart: number;
  korean: string;
  english: string;
  vocabulary: VocabularyItem[];
}

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  titleKorean: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationSeconds: number;
  thumbnail: string;
  tags: string[];
  transcript: Transcript[];
}
