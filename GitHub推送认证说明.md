# GitHub 推送认证（解决 Password authentication is not supported）

GitHub 不再支持用「账号密码」推送，需要改用 **个人访问令牌（PAT）** 或 SSH。

## 方法一：用个人访问令牌（推荐，最快）

### 1. 在 GitHub 创建令牌
1. 登录 GitHub → 右上角头像 → **Settings**
2. 左侧最下方点 **Developer settings**
3. 左侧点 **Personal access tokens** → **Tokens (classic)**
4. 点 **Generate new token** → **Generate new token (classic)**
5. Note 填：`yi-photo-push`（或任意备注）
6. Expiration 选 **90 days** 或 **No expiration**
7. 勾选权限：**repo**（会勾上 repo 下所有子项）
8. 拉到最下点 **Generate token**
9. **复制生成的令牌**（只显示一次，务必保存）

### 2. 用令牌推送（代替密码）
在终端执行（仓库地址保持你当前的）：

```bash
cd "/Users/91002302/Desktop/摄影作品集网站"
git push -u origin main
```

- **Username**：填 `zhangchunyi-zcy`
- **Password**：**不要填登录密码**，粘贴刚才复制的 **个人访问令牌**

推送成功即可。以后在同一台电脑上，系统可能已缓存凭证，再 push 可能不再询问。

---

## 方法二：改用 SSH（一次配置长期使用）

若已配置过 GitHub SSH 公钥，可把远程地址改为 SSH 再推送：

```bash
cd "/Users/91002302/Desktop/摄影作品集网站"
git remote set-url origin git@github.com:zhangchunyi-zcy/yi-photo.git
git push -u origin main
```

若从未配置过 SSH，需先在 GitHub 添加公钥，详见：  
https://docs.github.com/cn/authentication/connecting-to-github-with-ssh

---

推送成功后，到 **https://vercel.com** 用 GitHub 登录 → Import 仓库 `yi-photo` → Deploy 即可获得访问域名。
