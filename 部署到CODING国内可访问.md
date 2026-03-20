# 用腾讯云 CODING 部署（国内可访问，无需 Gitee 实名）

当 Gitee 实名认证链接 404、或找不到 Gitee Pages 时，可以用 **腾讯云 CODING** 部署同一套静态网站，获得国内可直接打开的链接（如 `https://你的团队.coding.net/p/项目名/d/静态网站名/git` 或类似 `xxx.coding.page` 的地址）。

---

## 一、注册并进入 CODING

1. 打开 **https://coding.net**（或从腾讯云控制台进入「CODING DevOps」）。
2. 使用微信/QQ/腾讯云账号登录或注册。
3. 登录后进入「团队」或「个人」工作台。

---

## 二、创建项目并推送代码

1. **新建项目**  
   - 点「创建项目」→ 选「DevOps 项目」或「代码托管」。
   - 项目名称可填：**yi-photo**，可见性选「公开」。
   - 创建时可不勾选「使用 README 初始化」，方便直接推送现有代码。

2. **在本地添加 CODING 远程并推送**  
   在**有本项目的电脑**上打开终端（把下面地址换成你在 CODING 里看到的仓库地址）：

   ```bash
   cd "/Users/91002302/Desktop/摄影作品集网站"
   git remote add coding https://e.coding.net/你的团队名/yi-photo/yi-photo.git
   git push coding main
   ```

   - CODING 的仓库地址在项目页「代码」→「克隆」里可以看到（HTTPS 或 SSH 均可）。
   - 若本地分支是 `master`，可先执行：`git branch -M main`，再 `git push coding main`。
   - 首次推送会要求输入 CODING 用户名和密码（或访问令牌）。

---

## 三、开启静态网站 / Pages

1. 进入该 CODING 项目，在左侧或顶部菜单找 **「持续部署」** 或 **「构建与部署」**。
2. 找到 **「静态网站」** 或 **「Pages」** 或 **「网站托管」** 类入口，点「新建」。
3. 按页面提示：
   - 选择刚推送的**代码仓库**和**分支**（如 `main`）。
   - **部署目录**留空表示根目录（本项目就是根目录）。
   - 保存并触发部署。
4. 部署完成后，页面会给出访问地址（一般为 `https://xxx.coding-pages.com` 或 `xxx.coding.page` 等形式）。

---

## 四、之后更新站点

改完代码后推送到 CODING 即可，部分配置下会自动重新部署，否则在「静态网站」里手动点「重新部署」：

```bash
git add .
git commit -m "更新说明"
git push coding main
```

---

**说明：** CODING 界面可能随版本调整，若菜单名称与上述略有不同，可在项目内搜索「静态网站」或「Pages」，或查阅腾讯云/CODING 官方文档。国内访问一般较稳定，无需 Gitee 实名认证。
