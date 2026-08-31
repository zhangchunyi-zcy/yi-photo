# 通过 GitHub + 腾讯云 COS/CDN 部署作品集

站点托管在 **腾讯云香港 COS**，经 **境外 CDN** 加速；**git push** 后 GitHub Actions 自动发布。国内（尤其深圳）访问通常优于 Vercel，**无需 VPN**。

完整控制台步骤见 **[《部署到腾讯云COS+CDN.md》](部署到腾讯云COS+CDN.md)**。

---

## 一、把项目推到 GitHub

若尚未关联 GitHub：

```bash
cd "/Users/91002302/Desktop/yi/vibe coding/摄影作品集网站"
git remote add origin git@github.com:你的用户名/yi-photo.git
git branch -M main
git push -u origin main
```

---

## 二、腾讯云 COS + CDN（一次性）

1. 创建 **香港** COS 桶，开启 **静态网站**（索引 `index.html`）
2. 创建 **境外加速** CDN，源站指向该桶
3. 配置 CDN 缓存规则（见《部署到腾讯云COS+CDN.md》）
4. 在 GitHub 仓库 **Settings → Secrets** 配置：
   - `TENCENT_SECRET_ID`
   - `TENCENT_SECRET_KEY`
   - `COS_BUCKET`
   - `CDN_DOMAIN`（可选，用于自动刷新 CDN）

---

## 三、首次自动部署

```bash
git push origin main
```

打开 GitHub 仓库 **Actions** 页，确认 `Deploy to Tencent COS` 工作流成功。用 CDN 控制台提供的域名访问站点。

---

## 四、绑定 yi-photo.cn（可选）

1. 在 CDN **境外加速** 下尝试添加 `yi-photo.cn`
2. 校验通过后，在 [腾讯云 DNS](https://console.cloud.tencent.com/cns) 将 `@` CNAME 到 CDN 提供的地址
3. 从 Vercel 移除该域名（若仍在使用 Vercel）

未备案时 `.cn` 绑境内 CDN 会失败；境外 CDN 以控制台校验为准。

---

## 五、之后更新网站

```bash
git add .
git commit -m "更新内容说明"
git push origin main
```

Actions 自动同步 COS 并刷新 CDN（若已配置 `CDN_DOMAIN`）。

---

## 六、自定义域名与备案

- **不备案**：可用 CDN 默认域名；可尝试 `yi-photo.cn` + 境外 CDN
- **备案后**：可切换 **境内 CDN** + **大陆 COS 桶**，国内访问更快（见《部署到腾讯云COS+CDN.md》第四节）
