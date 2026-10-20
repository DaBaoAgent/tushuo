#!/usr/bin/env bash
# 官渡地图全片质检：规格 / 帧数 / 电平 / 关键帧抽帧
set -u
cd /d/@kaifa/tushuo || exit 1
OUT=output/guandu-map
FILM=$OUT/tushuo-guandu-map.mp4
FF=vendor/gpt-sovits/runtime/ffmpeg.exe
FP=vendor/gpt-sovits/runtime/ffprobe.exe
[ -f "$FILM" ] || { echo "missing $FILM"; exit 1; }

echo '== 成片规格 =='
$FP -v error -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels \
  -of default=noprint_wrappers=1 "$FILM"

echo '== 实际帧数 =='
$FP -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$FILM"

echo '== 响度 (ebur128) =='
$FF -hide_banner -nostats -i "$FILM" -filter_complex ebur128=peak=true -f null - 2>&1 \
  | grep -E '^    I:|^    Peak:'

echo '== 峰值 (volumedetect) =='
$FF -hide_banner -nostats -i "$FILM" -af volumedetect -f null - 2>&1 \
  | grep -E 'mean_volume|max_volume'

mkdir -p "$OUT/_qa/final"
for t in 0.1 0.95 1.2 199.6 229.9 256.5 348 444 469 505 620 664.5; do
  $FF -y -v error -ss "$t" -i "$FILM" -frames:v 1 "$OUT/_qa/final/f-$t.png"
done
echo "抽帧 -> $OUT/_qa/final"
