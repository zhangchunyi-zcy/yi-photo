#!/bin/bash
# 用 macOS 内置 sips 生成缩略图（长边 300px，适合 72-144px 列表显示）
# 运行方式：cd 项目根目录 && bash 生成缩略图.sh

SRC="photos/摄影作品"
DST="photos/thumbs"
mkdir -p "$DST"

count=0
for f in "$SRC"/*.{jpg,JPG,jpeg,JPEG,png,PNG}; do
  [ -e "$f" ] || continue
  filename="$(basename "$f")"
  out="$DST/$filename"
  if [ ! -f "$out" ]; then
    sips -Z 1200 "$f" --out "$out" > /dev/null 2>&1
    echo "✓ $filename"
    count=$((count + 1))
  else
    echo "- 已存在，跳过: $filename"
  fi
done

echo ""
echo "完成！新生成 $count 张缩略图 → $DST/"
du -sh "$DST"
