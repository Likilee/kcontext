### 프론트엔드 클린 아키텍처: 의존성 규칙 및 인터페이스

**핵심 원칙:** 의존성의 방향은 반드시 **외부(UI/프레임워크/DB SDK) ➔ 내부(도메인/포트)** 로만 향해야 합니다. UI 컴포넌트는 Supabase의 존재 자체를 몰라야 합니다.

### 1. Domain Layer (순수 비즈니스 모델)

어떤 외부 라이브러리에도 의존하지 않는 순수한 TypeScript 타입입니다.

```tsx
// domain/models/Subtitle.ts
export interface VideoMeta {
  videoId: string;
  title: string;
  channelName: string;
}

export interface SearchResult extends VideoMeta {
  startTime: number;
  matchedText: string;
}

export interface SubtitleChunk {
  startTime: number;
  text: string;
}
```

### 2. Application Layer / Port (포트 - 계약서)

프론트엔드(UI)가 데이터를 가져오기 위해 요구하는 **추상화된 인터페이스(Port)**입니다.

```tsx
// application/ports/SubtitleRepository.ts
import { SearchResult, SubtitleChunk } from '../../domain/models/Subtitle';

// 💡 UI 레이어는 오직 이 인터페이스만 바라봅니다.
export interface SubtitleRepository {
  searchByKeyword(keyword: string): Promise<SearchResult[]>;
  getFullTranscript(videoId: string): Promise<SubtitleChunk[]>;
}
```

### 3. Infrastructure Layer / Adapter (어댑터 - 부패 방지 계층)

비로소 여기서 Supabase SDK와 `fetch` API가 등장합니다. 인터페이스를 구현하며, **DB의 원시 응답(예: snake_case)을 프론트엔드의 도메인 모델(camelCase)로 변환하는 Data Mapper 역할(부패 방지)**을 전담합니다.

```tsx
// infrastructure/adapters/SupabaseSubtitleRepository.ts
import { supabase } from '@/lib/supabase-client'; // 외부 종속성은 여기에만 격리
import { SubtitleRepository } from '@/application/ports/SubtitleRepository';
import { SearchResult, SubtitleChunk } from '@/domain/models/Subtitle';

export class SupabaseSubtitleRepository implements SubtitleRepository {
  
  async searchByKeyword(keyword: string): Promise<SearchResult[]> {
    // 1. 인프라 특화 로직 (Supabase RPC 호출)
    const { data, error } = await supabase.rpc('search_subtitles', { search_keyword: keyword });
    if (error) throw new Error(error.message);

    // 2. 🛡️ 안티 커럽션 (ACL): DB 스키마 -> 도메인 모델로 변환
    return data.map((row: any) => ({
      videoId: row.video_id,
      title: row.title,
      channelName: row.channel_name,
      startTime: row.start_time,
      matchedText: row.text
    }));
  }

  async getFullTranscript(videoId: string): Promise<SubtitleChunk[]> {
    // CDN URL 조합 로직도 Adapter 내부로 캡슐화
    const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL;
    const response = await fetch(`${CDN_URL}/subtitles/${videoId}.json`);
    const chunks = await response.json();
    
    return chunks.map((chunk: any) => ({
      startTime: chunk.start_time,
      text: chunk.text
    }));
  }
}
```

### 4. UI Layer / Dependency Injection (의존성 주입)

React/Next.js 컴포넌트나 커스텀 훅(`useSearch`)은 `SupabaseSubtitleRepository`를 직접 import 하지 않고, 컨텍스트나 DI 컨테이너를 통해 주입받은 `SubtitleRepository` 인터페이스의 메서드만 실행합니다.