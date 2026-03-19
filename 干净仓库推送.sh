#!/bin/bash
# 在临时目录建一个「只有代码、没有照片」的干净仓库并推送，保证体积小

set -e
REPO_DIR="/Users/91002302/Desktop/摄影作品集网站"
TEMP_DIR="/Users/91002302/Desktop/yi-photo-push"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# 只复制代码和必要文件，不复制 photos
cp -r "$REPO_DIR/css" "$TEMP_DIR/"
cp -r "$REPO_DIR/js" "$TEMP_DIR/"
cp "$REPO_DIR/index.html" "$TEMP_DIR/"
cp "$REPO_DIR/contact.html" "$TEMP_DIR/"
cp "$REPO_DIR/vercel.json" "$TEMP_DIR/" 2>/dev/null || true
cp "$REPO_DIR/.gitignore" "$TEMP_DIR/" 2>/dev/null || true
# 创建空的 photos 目录结构，避免站点 404（可选：也可不创建，用外链）
mkdir -p "$TEMP_DIR/photos/摄影作品"
# 不复制任何图片

cd "$TEMP_DIR"
git init
git add .
git commit -m "Initial: 摄影作品集网站（不含照片）"
git branch -M main
git remote add origin https://github.com/zhangchunyi-zcy/yi-photo.git
git push -u origin main --force

echo "推送完成。可删除临时目录: rm -rf $TEMP_DIR"
echo "到 https://vercel.com 导入 yi-photo 即可拿域名。"
