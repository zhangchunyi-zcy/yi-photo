# 不经过 GitHub，直接用 Vercel 部署拿域名

若 GitHub 推送一直 302/断连，可用 Vercel 从本地上传，直接拿到域名。

## 步骤

**不需要全局安装**，用 `npx` 即可（会临时下载并运行 Vercel，无需 sudo）。

### 1. 在项目目录登录并部署
```bash
cd "/Users/91002302/Desktop/摄影作品集网站"
npx vercel login
npx vercel --prod
```
- `npx vercel login`：按提示用浏览器或邮箱登录 Vercel。
- `npx vercel --prod`：把当前目录上传并部署到生产环境，完成后会给出一个域名，例如：  
  `https://摄影作品集网站-xxx.vercel.app`  
  或你设置的项目名对应的地址。

若没有 Node.js，先到 https://nodejs.org 安装 LTS 版。

### 3. 使用域名
把终端里给出的 **Production** 链接复制到浏览器即可访问；该链接即可分享给他人。

---

**说明：** 当前项目里 `photos/` 若在 .gitignore 中，上传时不会包含照片，线上图片会 404。若要带图部署，可先临时去掉 .gitignore 里的 `photos/`，再执行 `vercel --prod`（若照片多，上传会稍慢）。部署完再根据需要改回 .gitignore。

**之后更新站点：** 改完代码后在同一目录再执行一次 `vercel --prod` 即可更新线上版本。
