"""
CSV의 video_id들이 재생 가능한지 YouTube oEmbed API로 확인.
- 200: 재생/임베딩 가능
- 401: 임베딩 차단
- 404: 삭제/비공개
결과: unplayable 목록 + 필터링된 CSV 생성
"""
import csv
import time
import random
import requests
from pathlib import Path
from datetime import datetime

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


def load_csv(path):
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(row)
    return rows


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
        with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
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
    rows = load_csv(CSV_PATH)
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

        if vid in already_checked:
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
            label = "임베딩차단" if status == 401 else "삭제/비공개" if status == 404 else f"HTTP{status}"
            print(f"  [{i+1}/{total}] {vid} — {label}")

        if new_checks % BATCH_SIZE == 0:
            playable = sum(1 for v in results.values() if v == 200)
            unplayable = sum(1 for v in results.values() if v != 200)
            print(f"  --- {len(results)}/{total} 완료 (재생가능: {playable}, 불가: {unplayable}) ---")

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

    # Filtered CSV
    with open(FILTERED_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["channel_id", "channel_name", "video_id"])
        writer.writeheader()
        writer.writerows(playable_rows)

    # Unplayable CSV
    with open(UNPLAYABLE_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["channel_id", "channel_name", "video_id", "status"])
        writer.writeheader()
        writer.writerows(unplayable_rows)

    print(f"\n{'='*60}")
    print(f"완료 ({datetime.now().strftime('%H:%M:%S')})")
    print(f"  전체: {total}")
    print(f"  재생 가능: {len(playable_rows)}")
    print(f"  재생 불가: {len(unplayable_rows)}")
    print(f"  필터링 CSV: {FILTERED_CSV_PATH}")
    print(f"  재생불가 CSV: {UNPLAYABLE_CSV_PATH}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
