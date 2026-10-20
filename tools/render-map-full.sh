#!/usr/bin/env bash
# 官渡地图全片：30fps、52 秒分段、6 路并行渲染 → 拼接 picture.mp4
set -u
cd /d/@kaifa/tushuo || exit 1
OUT=output/guandu-map
LOGS=$OUT/_renderlogs
mkdir -p "$LOGS"
STATUS=$LOGS/status.txt
: > "$STATUS"

starts=(0 52 104 156 208 260 312 364 416 468 520 572 624)
durs=(52 52 52 52 52 52 52 52 52 52 52 52 45.132)

render(){
  local s=$1 d=$2
  echo "[start] $s $d $(date +%H:%M:%S)"
  node tools/render.mjs --slug=guandu-map --preview --fps=30 --start="$s" --seconds="$d" \
    > "$LOGS/seg-$s.log" 2>&1
  local rc=$?
  echo "$s $rc" >> "$STATUS"
  echo "[done ] $s rc=$rc $(date +%H:%M:%S)"
}

for i in 0 1 2 3 4 5; do render "${starts[$i]}" "${durs[$i]}" & done
wait
for i in 6 7 8 9 10 11; do render "${starts[$i]}" "${durs[$i]}" & done
wait
render "${starts[12]}" "${durs[12]}" &
wait

if grep -qv ' 0$' "$STATUS"; then
  echo 'FAILED SEGMENTS:'
  grep -v ' 0$' "$STATUS"
  exit 1
fi
echo 'ALL SEGMENTS OK'

: > "$OUT/concat.txt"
for i in "${!starts[@]}"; do
  echo "file 'preview-${starts[$i]}-${durs[$i]}.mp4'" >> "$OUT/concat.txt"
done
cat "$OUT/concat.txt"

vendor/gpt-sovits/runtime/ffmpeg.exe -y -v error -f concat -safe 0 -i "$OUT/concat.txt" \
  -c copy -movflags +faststart "$OUT/picture.mp4" || exit 1
echo 'PICTURE OK'
vendor/gpt-sovits/runtime/ffmpeg.exe -hide_banner -i "$OUT/picture.mp4" -f null - 2>&1 | grep Duration
