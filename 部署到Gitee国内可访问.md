# 部署到 Gitee Pages（国内可直接打开）

当 Vercel 链接在国内打不开时，可把同一项目部署到 **Gitee Pages**，获得一个国内能直接访问的链接（如 `https://你的用户名.gitee.io/yi-photo`）。

**若 Gitee 实名认证链接 404、或找不到实名/Pages 入口：** 建议直接用 **替代方案**，见本文末尾「替代方案」及项目里的 **《部署到CODING国内可访问.md》**，用腾讯云 CODING 部署静态站，国内一般可访问且无需 Gitee 实名。

---

## 〇、前置条件：Gitee 实名认证（必做）

**Gitee Pages 只有完成实名认证后才会出现或可用。**

**说明：** 以往实名认证的直达链接（如 `/profile/account/real_name`）可能已失效（访问会 404），Gitee 改版后入口经常变动。

**从设置里找：**  
1. 登录 Gitee → 右上角**头像** → **设置**（或「个人设置」）。
2. 在左侧或页面里找 **「账号管理」** 或 **「帐号与安全」**，点进去。
3. 找到 **「实名认证」** / **「真实姓名认证」** 相关入口，按提示提交（身份证等），等待 1～2 个工作日审核。

认证通过后，回到仓库页面，在顶部 **「服务」** 里才会出现 **Gitee Pages** 入口。

若仍找不到实名认证入口，或不想做实名认证，可改用下方「替代方案」。

---

## 一、在 Gitee 建仓库并推送代码

1. **注册/登录 Gitee**  
   打开 https://gitee.com 用手机或邮箱注册并登录。

2. **新建仓库**  
   - 右上角 **「+」→ 新建仓库**
   - 仓库名填：**yi-photo**（或任意英文）
   - 选 **公开**，不要勾选「使用 Readme 文件初始化」
   - 创建仓库

3. **在本地把 Gitee 加为远程并推送**  
   在**有本项目的电脑**上打开终端，执行（把 `你的Gitee用户名` 换成你的账号）：

   ```bash
   cd "/Users/91002302/Desktop/摄影作品集网站"
   git remote add gitee https://gitee.com/你的Gitee用户名/yi-photo.git
   git push gitee main
   ```

   - 若 Gitee 仓库是空的，可能需先执行：`git push -u gitee main`
   - 首次推送会要求输入 Gitee 用户名和密码（或令牌）。

4. **若本地分支叫 master**  
   先执行：`git branch -M main`，再执行上面的 `git push gitee main`。

---

## 二、开启 Gitee Pages

**前提：** 已完成上方「〇、前置条件」中的 Gitee 实名认证，否则页面上不会出现 Gitee Pages 入口。

1. 打开该仓库页面，点顶部 **「服务」**，在下拉或列表里找 **「Gitee Pages」**（有的版本叫「静态 Pages」或「Pages 服务」）。
2. 选择部署分支：**main**（或你推送的分支名）。
3. 部署目录留空（根目录即可）。
4. 点 **「启动」** 或 **「更新」**，等几分钟。
5. 部署完成后会显示访问地址，一般为：  
   **https://你的Gitee用户名.gitee.io/yi-photo**  
   或 **https://你的Gitee用户名.gitee.io/仓库名**

---

## 三、之后更新站点

改完代码后，推送到 Gitee 即可更新 Pages：

```bash
git add .
git commit -m "更新说明"
git push gitee main
```

然后在 Gitee 仓库里进入 **Gitee Pages** 页面，点 **「更新」** 重新部署（部分账号会自动触发）。

---

**说明：** Gitee 免费版 Pages 有时需要手动点「更新」才会重新部署；若你同时用 GitHub，可保留 `origin` 推 GitHub、`gitee` 推 Gitee，两个链接都能用（国内用 Gitee，有 VPN 时用 Vercel）。

---

## 替代方案（不想做 Gitee 实名认证时）

- **Coding.net（腾讯云 CODING）**：可做静态网站托管，需注册并创建项目，把代码推送上去后开启「静态网站」/ Pages，会得到一个 `xxx.coding.page` 之类链接，国内一般可访问。
- **Cloudflare Pages**：国外服务，国内访问可能仍不稳定，适合有 VPN 时用。
- **自建 / 买云主机**：有域名和服务器后，把当前项目上传到服务器用 Nginx 等托管，完全自己控制，国内访问取决于服务器所在地区。
