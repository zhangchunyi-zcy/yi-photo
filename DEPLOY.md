# 通过 GitHub + Vercel 部署作品集（极速访问）

按下面步骤操作即可获得一个可分享的在线链接（如 `https://你的项目名.vercel.app`）。

## 一、把项目推到 GitHub

1. **安装 Git**（若未安装）  
   - 官网：https://git-scm.com/

2. **在项目文件夹里初始化并提交**
   ```bash
   cd "/Users/91002302/Desktop/摄影作品集网站"
   git init
   git add .
   git commit -m "Initial: 摄影作品集网站"
   ```

3. **在 GitHub 新建仓库**
   - 打开 https://github.com/new
   - 仓库名自定（如 `photo-portfolio`），选 **Public**，不要勾选 “Add a README”
   - 创建后记下仓库地址，例如：`https://github.com/你的用户名/photo-portfolio.git`

4. **关联并推送**
   ```bash
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git branch -M main
   git push -u origin main
   ```
   按提示用 GitHub 账号登录或配置 SSH。

---

## 二、用 Vercel 部署

1. **打开 Vercel**  
   https://vercel.com → 用 GitHub 登录。

2. **导入项目**
   - 点击 **Add New…** → **Project**
   - 在列表里选刚推送的 **你的仓库**（若未出现，点 **Import Git Repository** 并授权）
   - **Framework Preset** 保持 **Other** 即可
   - **Root Directory** 不填（用仓库根目录）
   - 点击 **Deploy**

3. **等待部署**
   - 约 1～2 分钟会生成一个域名，例如：  
     `https://photo-portfolio-xxx.vercel.app`

4. **分享链接**
   - 在 Vercel 项目页的 **Domains** 里复制该地址，即可发给他人访问。

---

## 三、之后更新网站

改完本地代码后执行：

```bash
git add .
git commit -m "更新内容说明"
git push
```

Vercel 会自动重新部署，几分钟内新链接内容会更新。

---

## 可选：自定义域名

在 Vercel 项目 → **Settings** → **Domains** 里可绑定自己的域名（需在域名服务商处把 DNS 指到 Vercel 提供的记录）。
