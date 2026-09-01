# 部署到腾讯云 COS + CDN（香港节点，替代 Vercel）

本方案将摄影作品集托管在 **腾讯云香港 COS**，经 **境外 CDN** 加速，**git push 后 GitHub Actions 自动发布**。主要面向 **国内（尤其深圳）** 访问，**不需要 VPN**。

详细控制台步骤见下文；代码仓库已包含 [`.github/workflows/deploy-cos.yml`](.github/workflows/deploy-cos.yml)。

---

## 架构概览

```
git push main → GitHub Actions → 香港 COS（ap-hongkong）→ 境外 CDN → 访客
                                                      ↑
                                            yi-photo.cn（可选，控制台校验）
```

| 组件 | 配置 |
|------|------|
| COS 地域 | **中国香港 `ap-hongkong`** |
| CDN 加速区域 | **境外（含港澳台）** |
| 备案 | 不备案可用；绑 `.cn` 到**境内 CDN** 则必须备案 |
| 深圳访问 | 通常比 Vercel 新加坡快 **2～3 倍**，无需 VPN |

---

## 一、腾讯云控制台（一次性）

### 1. 创建 COS 存储桶

1. 打开 [COS 控制台](https://console.cloud.tencent.com/cos)
2. **创建存储桶**
   - 名称：如 `yi-photo-125xxxxxx`（全局唯一，记下完整名称）
   - **地域**：**中国香港**
   - 访问权限：**公有读私有写**
   - 其他保持默认
3. **基础配置 → 静态网站**
   - 开启
   - 索引文档：`index.html`
   - 错误文档：`index.html`（可选）

> 桶地域创建后不可修改。将来若备案并追求大陆最快速度，需新建广州/上海桶并迁移文件。

### 2. 创建 CDN（境外加速）

1. 打开 [CDN 控制台](https://console.cloud.tencent.com/cdn)
2. **添加域名**
   - **加速区域**：**境外（含港澳台）**
   - 先用 **CDN 默认域名**（`*.cdn.myqcloud.com`）验证全站
   - **源站类型**：COS 源
   - **源站**：选择上一步香港桶
   - **回源协议**：HTTPS
   - **HTTPS**：开启（免费证书）
3. 可选：尝试添加自定义域名 `yi-photo.cn`（未备案时以控制台校验为准）

### 3. CDN 缓存规则

在 CDN → 域名 → **缓存配置**（从具体到通用）：

| 路径 | 缓存时间 |
|------|----------|
| `/photos/*` | 365 天 |
| `/js/*`、`/css/*` | 不缓存或 60 秒 |
| `/index.html`、`/contact.html` | 不缓存或 60 秒 |
| 默认 | 1 天 |

### 4. API 密钥（给 GitHub Actions）

1. [访问管理 → API 密钥](https://console.cloud.tencent.com/cam/capi) 创建密钥
2. 建议用**子账号**，仅授予 COS 桶读写 + CDN 刷新权限

---

## 二、GitHub Secrets

仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Secret 名称 | 说明 | 必填 |
|-------------|------|------|
| `TENCENT_SECRET_ID` | 腾讯云 SecretId | 是 |
| `TENCENT_SECRET_KEY` | 腾讯云 SecretKey | 是 |
| `COS_BUCKET` | 桶名称，如 `yi-photo-125xxxxxx` | 是 |
| `CDN_DOMAIN` | CDN 加速域名，如 `yi-photo.cn` 或 `xxx.cdn.myqcloud.com` | 否（填了则部署后自动刷新 CDN） |

`COS_REGION` 已在 workflow 中固定为 `ap-hongkong`，无需单独配置。

---

## 三、GitHub Actions 工作流

文件路径：`.github/workflows/deploy-cos.yml`

- **触发**：推送到 `main`，或 Actions 页手动 **Run workflow**
- **行为**：`coscli sync` 上传站点文件（排除 `.git`、文档、脚本等），可选刷新 CDN 全站缓存

首次部署：push 后打开 **Actions** 标签页查看日志，约 2～5 分钟（含 ~150MB 图片）。

---

## 四、DNS：yi-photo.cn

当前域名若在 Vercel，需切换解析：

### 不备案 + 境外 CDN

1. Vercel 控制台 → 项目 → **Domains** → 删除 `yi-photo.cn`
2. CDN 控制台尝试添加 `yi-photo.cn`（境外加速）
   - **校验通过**：腾讯云 DNS 添加 CNAME `@` → CDN 提供的 CNAME
   - **校验失败**：暂用 CDN 默认域名对外分享
3. 删除原指向 Vercel 的 A 记录（`@ → 216.198.79.1`）

### 将来备案后（可选升级）

1. CDN 新建 **中国境内加速** 域名，绑定 `yi-photo.cn`
2. 建议新建 **广州 COS 桶**，从香港桶迁移文件，CDN 改回源到大陆桶
3. DNS CNAME 指向新的 CDN 记录

---

## 五、日常更新

```bash
git add .
git commit -m "更新说明"
git push origin main
```

推送后 GitHub Actions 自动同步 COS；若配置了 `CDN_DOMAIN`，会尝试刷新 CDN。

---

## 六、下线 Vercel

1. Vercel → 项目 → Domains 移除 `yi-photo.cn`
2. 可选：删除 Vercel 项目
3. 本地不再使用 `npx vercel --prod`
4. 仓库已删除 `vercel.json`（缓存改由 CDN 控制台配置）

---

## 七、验证清单

- [ ] CDN 默认域名 / yi-photo.cn 能打开首页
- [ ] 中文路径图片正常，如 `photos/摄影作品压缩/捕梦网Ⅰ Contax G1 low.jpg`
- [ ] `contact.html` 可访问
- [ ] push 后 Actions 成功，线上内容更新
- [ ] 深圳普通网络访问，**无需 VPN**

---

## 八、常见问题

**403 / Access Denied**  
检查桶权限是否为「公有读私有写」，静态网站是否已开启。

**图片 404**  
确认 `data.js` 中路径大小写与 COS 中文件名一致（Linux/COS 区分大小写）。

**更新了代码但页面没变**  
在 CDN 控制台手动「URL 刷新」`/*`，或确认 `CDN_DOMAIN` Secret 已配置。

**GitHub Actions 上传失败**  
检查 Secrets 是否正确；大仓库首次同步可能需 5 分钟，查看 Actions 日志。

**`.cn` 无法绑 CDN**  
未备案时改用 CDN 默认域名；或提交 ICP 备案后改用境内加速。

---

## 九、成本参考

- COS 存储 ~150MB：每月约 **几毛～几元**
- CDN 流量：按量计费，摄影站图片较多，建议在腾讯云设置 **用量告警**
- 香港桶跨境流出：单价略高于大陆，个人作品集通常仍很低

---

## 附录：GitHub Actions 工作流（`.github/workflows/deploy-cos.yml`）

若仓库中尚无该文件，请在项目根目录创建并粘贴以下内容，然后 `git push`：

```yaml
# 推送 main 分支后，将静态站点同步到腾讯云香港 COS，并刷新 CDN 缓存。
name: Deploy to Tencent COS

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  COS_REGION: ap-hongkong

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install coscli
        run: |
          # 使用腾讯云官方直链，避免 GitHub release 文件名变更导致 404
          curl -fsSL "https://cosbrowser.cloud.tencent.com/software/coscli/coscli-linux-amd64" -o coscli
          chmod +x coscli
          sudo mv coscli /usr/local/bin/coscli
          coscli --version

      - name: Configure coscli
        run: |
          coscli config init \
            --secret-id "${{ secrets.TENCENT_SECRET_ID }}" \
            --secret-key "${{ secrets.TENCENT_SECRET_KEY }}" \
            --bucket-name "${{ secrets.COS_BUCKET }}" \
            --region "${COS_REGION}" \
            --ofs false \
            --force

      - name: Sync site to COS
        run: |
          coscli sync . "cos://${{ secrets.COS_BUCKET }}/" \
            --recursive \
            --exclude ".git/**" \
            --exclude ".github/**" \
            --exclude ".cursor/**" \
            --exclude ".vercel/**" \
            --exclude "**/.DS_Store" \
            --exclude "**/Thumbs.db" \
            --exclude "**/*.log" \
            --exclude "**/*.md" \
            --exclude "**/*.sh" \
            --exclude "**/*.txt" \
            --exclude ".gitignore"

      - name: Purge CDN cache
        if: ${{ secrets.CDN_DOMAIN != '' }}
        env:
          CDN_DOMAIN: ${{ secrets.CDN_DOMAIN }}
          TENCENT_SECRET_ID: ${{ secrets.TENCENT_SECRET_ID }}
          TENCENT_SECRET_KEY: ${{ secrets.TENCENT_SECRET_KEY }}
        run: |
          python3 << 'PY'
          import hashlib, hmac, json, os, sys, time, urllib.request
          secret_id = os.environ["TENCENT_SECRET_ID"]
          secret_key = os.environ["TENCENT_SECRET_KEY"]
          service, host = "cdn", "cdn.tencentcloudapi.com"
          payload = json.dumps({"Paths": ["/"], "FlushType": "flush"})
          timestamp = int(time.time())
          date = time.strftime("%Y-%m-%d", time.gmtime(timestamp))
          def sign(key, msg):
              return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()
          canonical_request = (
              "POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:" + host + "\n\n"
              "content-type;host\n" + hashlib.sha256(payload.encode()).hexdigest()
          )
          scope = date + "/" + service + "/tc3_request"
          sts = "TC3-HMAC-SHA256\n" + str(timestamp) + "\n" + scope + "\n" + hashlib.sha256(canonical_request.encode()).hexdigest()
          sig = hmac.new(sign(sign(sign(("TC3"+secret_key).encode(), date), service), "tc3_request"), sts.encode(), hashlib.sha256).hexdigest()
          auth = "TC3-HMAC-SHA256 Credential=" + secret_id + "/" + scope + ", SignedHeaders=content-type;host, Signature=" + sig
          req = urllib.request.Request("https://" + host, data=payload.encode(), headers={
              "Authorization": auth, "Content-Type": "application/json; charset=utf-8",
              "Host": host, "X-TC-Action": "PurgePathCache", "X-TC-Timestamp": str(timestamp),
              "X-TC-Version": "2018-06-06", "X-TC-Region": ""}, method="POST")
          try:
              print(urllib.request.urlopen(req, timeout=30).read().decode())
          except Exception as e:
              print("CDN purge failed (non-fatal):", e, file=sys.stderr)
          PY
```
