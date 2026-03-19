# 在别的电脑（Windows，无 Cursor）用 GitHub + Vercel 部署

在 Windows 上按下面做，用 GitHub 存代码、用 Vercel 自动部署拿到在线链接。不需要 Cursor。

---

## 一、把项目弄到这台 Windows 电脑上

任选一种：

- **U 盘**：把「摄影作品集网站」整个文件夹拷到 U 盘，再拷到 Windows 的桌面或某个目录（如 `D:\项目\摄影作品集网站`）。
- **网盘**：在现在电脑上传整个文件夹，在 Windows 上下载并解压到某个目录。

记下在 Windows 上的路径，例如：`D:\项目\摄影作品集网站` 或 `C:\Users\你的用户名\Desktop\摄影作品集网站`。

---

## 二、在 Windows 上安装 Git

1. 打开浏览器访问：**https://git-scm.com/download/win**
2. 下载 **64-bit Git for Windows Setup**，双击安装。
3. 安装时选项可默认，一路 Next，完成即可。
4. 安装好后：在开始菜单找到 **Git Bash**，或任意位置右键选 **“在终端中打开”**（若已安装 Windows 终端），后面都用它执行命令。

---

## 三、在项目文件夹里用 Git 推送到 GitHub

### 1. 打开终端并进入项目目录

在项目文件夹里 **右键 → “在终端中打开”**，或在 Git Bash 里执行（路径改成你实际路径）：

```bash
cd "D:/项目/摄影作品集网站"
```

（Windows 下路径可用 `/`，或写 `D:\项目\摄影作品集网站`，路径有空格或中文时用英文双引号包起来。）

### 2. 若文件夹里还没有 .git（从没做过 git init）

执行：

```bash
git init
git add .
git commit -m "Initial: 摄影作品集网站"
git branch -M main
git remote add origin https://github.com/zhangchunyi-zcy/yi-photo.git
git push -u origin main
```

### 3. 若文件夹里已有 .git（在别的电脑已经 init 过）

只执行：

```bash
git remote set-url origin https://github.com/zhangchunyi-zcy/yi-photo.git
git push -u origin main
```

### 4. 推送时提示输入密码

- **Username**：填 `zhangchunyi-zcy`
- **Password**：填你的 **GitHub 个人访问令牌**（不是登录密码）。  
  若还没有令牌：打开 https://github.com/settings/tokens → Generate new token (classic) → 勾选 **repo** → 生成后复制保存，在 Password 处粘贴。

若推送时出现 **HTTP 302、连接断开**，多半是网络限制，可尝试：

- 换手机热点再试；
- 或先不推照片：在项目里确保 `photos/` 已在 `.gitignore`，并执行  
  `git rm -r --cached "photos/"`、`git add .`、`git commit -m "不含照片"`，再 `git push`（先让代码上去，照片以后用图床或换网络再推）。

---

## 四、在 Vercel 用 GitHub 部署拿链接

1. 打开浏览器访问：**https://vercel.com**
2. 点 **Sign Up** 或 **Log In**，选 **Continue with GitHub**，用你的 GitHub 账号登录并授权。
3. 登录后点 **Add New…** → **Project**。
4. 在列表里找到 **yi-photo**（或你推送到的仓库名），点 **Import**。
5. **Framework Preset** 保持默认（如 Other），**Root Directory** 不填，直接点 **Deploy**。
6. 等一两分钟，部署完成后会显示你的在线地址，例如：  
   **https://yi-photo-xxxx.vercel.app**  
   这就是你的**在线分享链接**，用浏览器打开或发给别人即可。

之后每次你在任意电脑上改完代码并 **git push** 到该仓库，Vercel 都会自动重新部署，无需再在 Windows 上跑别的命令。

---

## 五、以后在这台 Windows 上更新网站

1. 打开项目文件夹，在终端里进入该目录（同上）。
2. 改完代码或图片后执行：
   ```bash
   git add .
   git commit -m "更新说明"
   git push
   ```
3. 等 1～2 分钟，再打开之前的 Vercel 链接，即可看到更新后的内容。

---

## 小结

| 步骤       | 操作 |
|------------|------|
| 项目到 Windows | U 盘或网盘拷贝整个「摄影作品集网站」文件夹 |
| 安装 Git   | https://git-scm.com/download/win 下载安装 |
| 推送到 GitHub | 在项目目录用 Git Bash/终端执行 `git init`（若无 .git）、`git add .`、`git commit`、`git remote`、`git push`，密码用个人访问令牌 |
| 拿在线链接 | https://vercel.com 用 GitHub 登录 → Import 仓库 yi-photo → Deploy |
| 以后更新   | 改代码 → `git add .`、`git commit`、`git push`，Vercel 自动部署 |

不需要 Cursor，只需要：浏览器、Git for Windows、项目文件夹和 GitHub 账号。
