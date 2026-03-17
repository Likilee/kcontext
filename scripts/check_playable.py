"""
CSV의 video_id들이 재생 가능한지 YouTube oEmbed API로 확인.
- 200: 재생/임베딩 가능
- 401: 임베딩 차단
- 404: 삭제/비공개
결과: unplayable 목록 + 필터링된 CSV 생성
"""

import csv
import random
import time
from datetime import datetime
from pathlib import Path

import requests

BASE_DIR = Path(__file__).parent.parent
CSV_PATH = BASE_DIR / "docs" / "manual_ko_subtitle_videos.csv"
FILTERED_CSV_PATH = BASE_DIR / "docs" / "manual_ko_subtitle_videos_filtered.csv"
UNPLAYABLE_CSV_PATH = BASE_DIR / "docs" / "unplayable_videos.csv"

OEMBED_URL = "https://www.youtube.com/oembed"
BATCH_SIZE = 50  # print progress every N
DELAY = (0.3, 0.7)  # seconds between requests
PAUSE_EVERY = 200  # longer pause every N requests
PAUSE_DURATION = (5, 10)

# Resume support
PROGRESS_PATH = BASE_DIR / "docs" / "check_playable_progress.csv"


def dedupe_rows_by_video_id(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """Keep the first row for each video_id while preserving input order."""
    deduped_rows: list[dict[str, str]] = []
    seen_video_ids: set[str] = set()

    for row in rows:
        video_id = row["video_id"]
        if video_id in seen_video_ids:
            continue
        seen_video_ids.add(video_id)
        deduped_rows.append(row)

    return deduped_rows


def load_csv(path):
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])
    return fieldnames, rows


def check_oembed(video_id):
    """Returns (status_code, reason)"""
    try:
        resp = requests.get(
            OEMBED_URL,
            params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"},
            timeout=10,
        )
        return resp.status_code
    except requests.Timeout:
        return "TIMEOUT"
    except requests.RequestException as e:
        return f"ERROR:{e}"


def load_progress():
    """Load already-checked results for resume."""
    checked = {}
    if PROGRESS_PATH.exists():
        with open(PROGRESS_PATH, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                checked[row["video_id"]] = int(row["status"])
    return checked


def save_progress_row(video_id, status):
    exists = PROGRESS_PATH.exists()
    with open(PROGRESS_PATH, "a", encoding="utf-8") as f:
        if not exists:
            f.write("video_id,status\n")
        f.write(f"{video_id},{status}\n")


def main():
    fieldnames, rows = load_csv(CSV_PATH)
    total = len(rows)
    print(f"총 {total}개 영상 확인 시작 ({datetime.now().strftime('%H:%M:%S')})")

    # Resume support
    already_checked = load_progress()
    if already_checked:
        print(f"  이전 진행분 {len(already_checked)}개 로드 (이어서 진행)")

    results = {}  # video_id -> status_code
    results.update(already_checked)

    new_checks = 0
    consecutive_errors = 0

    for i, row in enumerate(rows):
        vid = row["video_id"]

        if vid in results:
            continue

        status = check_oembed(vid)

        if isinstance(status, str):
            # Network error or timeout - skip but don't save
            print(f"  [{i+1}/{total}] {vid} — {status} (스킵)")
            consecutive_errors += 1
            if consecutive_errors >= 10:
                print("\n  연속 에러 10회 — 중단. 다시 실행하면 이어서 진행됩니다.")
                break
            time.sleep(3)
            continue

        consecutive_errors = 0
        results[vid] = status
        save_progress_row(vid, status)
        new_checks += 1

        if status != 200:
            if status == 401:
                label = "임베딩차단"
            elif status == 404:
                label = "삭제/비공개"
            else:
                label = f"HTTP{status}"
            print(f"  [{i+1}/{total}] {vid} — {label}")

        if new_checks % BATCH_SIZE == 0:
            playable = sum(1 for v in results.values() if v == 200)
            unplayable = sum(1 for v in results.values() if v != 200)
            print(
                f"  --- {len(results)}/{total} 완료 "
                f"(재생가능: {playable}, 불가: {unplayable}) ---"
            )

        # Rate limiting
        if new_checks % PAUSE_EVERY == 0:
            pause = random.uniform(*PAUSE_DURATION)
            print(f"  [{new_checks}건 체크] {pause:.0f}초 쉬는 중...")
            time.sleep(pause)
        else:
            time.sleep(random.uniform(*DELAY))

    # Write results
    playable_rows = []
    unplayable_rows = []

    for row in rows:
        vid = row["video_id"]
        status = results.get(vid)
        if status is None:
            playable_rows.append(row)  # unchecked → keep
        elif status == 200:
            playable_rows.append(row)
        else:
            row_with_status = dict(row)
            row_with_status["status"] = status
            unplayable_rows.append(row_with_status)

    deduped_playable_rows = dedupe_rows_by_video_id(playable_rows)
    deduped_unplayable_rows = dedupe_rows_by_video_id(unplayable_rows)
    duplicate_rows_removed = (
        len(playable_rows)
        - len(deduped_playable_rows)
        + len(unplayable_rows)
        - len(deduped_unplayable_rows)
    )
    playable_rows = deduped_playable_rows
    unplayable_rows = deduped_unplayable_rows

    # Filtered CSV
    with open(FILTERED_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(playable_rows)

    # Unplayable CSV
    with open(UNPLAYABLE_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        unplayable_fieldnames = fieldnames if "status" in fieldnames else [*fieldnames, "status"]
        writer = csv.DictWriter(f, fieldnames=unplayable_fieldnames)
        writer.writeheader()
        writer.writerows(unplayable_rows)

    print(f"\n{'='*60}")
    print(f"완료 ({datetime.now().strftime('%H:%M:%S')})")
    print(f"  전체: {total}")
    print(f"  재생 가능: {len(playable_rows)}")
    print(f"  재생 불가: {len(unplayable_rows)}")
    if duplicate_rows_removed:
        print(f"  중복 video_id 제거: {duplicate_rows_removed}")
    print(f"  필터링 CSV: {FILTERED_CSV_PATH}")
    print(f"  재생불가 CSV: {UNPLAYABLE_CSV_PATH}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
