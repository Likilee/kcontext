# channel-pipeline.sh Options

Source: `cli/scripts/channel-pipeline.sh`

## Core flags

- `--url <url>`: YouTube channel/playlist URL
- `--target <n>`: Number of videos to push
- `--workspace <dir>`: Output workspace directory

## Proxy flags

- `--proxy-url <url>`: Explicit proxy URL for YouTube requests
- `--no-proxy`: Disable proxy usage

## Filtering flags

- `--manual-ko-only`: Include only videos with manual Korean subtitles (default)
- `--no-manual-ko-only`: Disable manual Korean subtitle filter
- `--probe-max-candidates <n>`: Candidate scan size for subtitle probing

## Existing ID flags

- `--skip-existing`: Skip IDs already in DB `video` table (default)
- `--no-skip-existing`: Process even if IDs already exist

## Help

- `-h`, `--help`: Print usage
