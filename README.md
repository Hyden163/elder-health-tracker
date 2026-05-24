# 老人健康记录应用

这是一个用于老人早晚录入心率、血压（高压/低压）和血氧，并展示近 7 天 / 30 天 / 90 天趋势的网页应用。家人可通过**微信群里的同一个 HTTPS 链接**录入或查看数据。

## 本地运行

1. 进入项目目录：
   ```bash
   cd '/Users/Hyden/Working Space/Vibe coding/health data'
   ```
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动服务：
   ```bash
   npm start
   ```
4. 打开浏览器访问：
   ```text
   http://localhost:3000
   ```

## 微信群使用说明

### 基本流程

1. 将应用部署到 **HTTPS** 公网地址（见下文「部署到公网」）。
2. 子女在家庭微信群发送链接，例如：
   ```text
   爸妈健康记录：https://你的域名.com
   点链接录入或查看，建议置顶这条消息。
   ```
3. 老人**早晨、晚上各录一次**；录入成功后点 **「复制摘要，发到微信群」**，粘贴到群里，家人即可看到今日数据。
4. 子女需要看趋势时，点开同一链接，展开 **「查看趋势与历史记录」**。

### 使用建议

- 帮老人第一次打开链接，并**收藏**或**添加到手机桌面**，减少找链接的成本。
- 微信群只是入口，数据保存在你的服务器上；**不要把链接发到公开大群或朋友圈**。
- 定期在趋势页点击 **「导出 XML」** 做本地备份，或给医生查看。

### 微信内体验

- 录入区默认在页面最上方，按钮和字号已针对手机放大。
- 趋势图默认折叠，避免微信内首屏加载过慢；可先查看 **最近记录（列表）**。
- 录入成功后可一键复制摘要，弥补微信无法自动推送群消息的限制。

## 部署到公网（HTTPS）

微信内置浏览器要求使用 **HTTPS**。

| 需求 | 推荐方案 |
|------|----------|
| **7×24、固定链接、不用每天管** | [微信云托管](#腾讯云云托管推荐724-固定链接)（下文详述） |
| 已在用 CNB、偶尔点一下可以接受 | [CNB 仅预览模式](#cnb-仅预览模式推荐已在用-cnb-时) |
| 国外平台 | Render / Railway |

### 通用配置

| 项 | 值 |
|----|-----|
| 构建命令 | `npm install` |
| 启动命令 | `npm start` |
| 端口 | 由平台注入 `PORT`（代码已支持） |

### 数据持久化（重要）

当前数据保存在 `data/health.json`。云平台上必须启用**持久化磁盘**，否则重启后数据会丢失。

可通过环境变量指定数据目录（挂载持久化卷的路径）：

```bash
DATA_DIR=/var/data
```

服务启动时会自动创建目录和空的 `health.json`。

### Render 示例

1. 新建 Web Service，连接 GitHub 仓库。
2. Build Command: `npm install`；Start Command: `npm start`。
3. 添加 **Persistent Disk**，挂载路径如 `/var/data`，并设置 `DATA_DIR=/var/data`。
4. 部署完成后获得 `https://xxx.onrender.com`，用微信打开测试。

### Railway

- 配置 `npm install` 与 `npm start`。
- 确认平台提供持久化存储，并设置 `DATA_DIR` 指向该路径。

### CNB 仅预览模式（推荐，已在用 CNB 时）

CNB 社区版**没有**单独的「部署服务」菜单。推荐用 **仅预览模式**：点一次「云原生开发」即自动启动应用并打开 HTTPS 预览页，**无需** WebIDE、手动装 Node、或映射端口。

仓库已配置 [`.ide/Dockerfile`](.ide/Dockerfile) 与 [`.cnb.yml`](.cnb.yml) 中的 `$: vscode` 段。

#### 第一次部署

1. 把代码推到 CNB（在 Mac 终端）：
   ```bash
   cd '/Users/Hyden/Working Space/Vibe coding/health data'
   git push cnb main
   ```
2. 打开 [CNB 仓库](https://cnb.cool/Plinkblink_Films/elder-health-tracker) → 点右上角 **「云原生开发」**。
3. 等待约 1–2 分钟，浏览器会**自动打开**健康记录页面（不会进入 WebIDE）。
4. 复制地址栏的 **HTTPS 链接**，发到家庭微信群并置顶，例如：
   ```text
   爸妈健康记录：https://xxxx.cnb.run
   点链接录入，早晚各一次。
   ```
5. 手机微信打开链接，试录入一条数据。

#### 日常使用

| 情况 | 你要做什么 |
|------|------------|
| 家人正常早晚录入 | **什么都不用做**（有访问会自动保活，最长 24 小时） |
| 链接打不开 | 再点一次 **「云原生开发」** 即可（比 WebIDE 少很多步骤） |

#### 数据保存在哪

- 健康数据在 `data/health.json`，CNB 会通过 `backup: true` 在环境重启后恢复。
- **不要把** `data/health.json` 提交到 Git（含管理员密码哈希）。

#### 从 WebIDE 迁移已有数据（一次性）

若之前在 WebIDE 里录过数据：

1. 在旧 WebIDE 终端执行 `cat data/health.json`，复制内容。
2. 启动仅预览模式后，在环境里把文件写回 `data/health.json`；或数据不多时在网页里重新录入。

#### 仅预览模式的局限

- 不是严格 7×24：超过 24 小时且无人访问时环境会休眠，需再点「云原生开发」。
- 预览链接可能随环境变化；若需要**固定域名、完全不用管**，见下文「腾讯云云托管」。

#### 验收

- [ ] 点「云原生开发」后自动打开页面（无需 WebIDE）
- [ ] 手机微信能打开 HTTPS 链接
- [ ] 录入后另一台手机刷新能看到新数据
- [ ] 关闭环境再启动后，历史数据仍在

### 腾讯云云托管（推荐：7×24 固定链接）

若希望**完全不用每天管**、微信群链接**长期不变**，请用 **微信云托管**（腾讯云旗下，微信扫码登录，适合本应用）。

仓库已提供 [`Dockerfile`](Dockerfile)、[`.dockerignore`](.dockerignore)。按下面步骤操作即可。

#### 第 1 步：打开控制台并创建环境

1. 浏览器打开 [微信云托管控制台](https://cloud.weixin.qq.com/cloudrun)
2. 微信扫码登录
3. 若提示选择小程序/公众号：选任意一个你有的（没有可先注册测试号），或按提示**新建环境**
4. 新建环境时填一个名称（如 `health-family`），记下环境 ID

#### 第 2 步：创建服务

1. 点击 **新建服务**
2. 服务名称填：`elder-health-tracker`
3. **开启「允许公网访问」**（必须，否则微信打不开）
4. 创建完成后进入该服务详情

#### 第 3 步：打包并上传代码

在 Mac 终端执行（生成上传用的 zip）：

```bash
cd '/Users/Hyden/Working Space/Vibe coding/health data'
chmod +x scripts/package-cloudrun.sh
./scripts/package-cloudrun.sh
```

会得到 `elder-health-cloudrun.zip`。

回到云托管控制台：

1. 进入 `elder-health-tracker` 服务 → **部署发布** → **新建版本**
2. 选择方式：**手动上传代码包**
3. 上传 `elder-health-cloudrun.zip`
4. 构建方式选 **Dockerfile 构建**（使用仓库根目录的 Dockerfile）
5. **容器端口**填：`3000`
6. 环境变量（点「添加」）：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_ENV` | `production` | 生产模式 |
| `DATA_DIR` | `/data` | 数据目录（见下一步挂载） |
| `FAMILY_ACCESS_KEY` | 一串随机字符 | 可选，限制只有家人能访问 |

7. 点击 **发布**，等待约 3–5 分钟（构建 + 部署）

#### 第 4 步：配置数据持久化（重要）

不配置的话，重新部署后健康数据会丢失。

1. 在服务详情 → **存储挂载** → **启用存储挂载**
2. 类型选 **对象存储（COS）** → 使用云开发对象存储即可
3. **实例挂载路径**填：`/data`（与 `DATA_DIR` 一致）
4. 保存后**再发布一次**新版本（或重启服务）

#### 第 5 步：发布并拿到固定链接

1. 版本状态变为 **正常** 后，进入 **服务设置** 或 **公网访问**
2. 复制默认域名，形如：
   ```text
   https://elder-health-tracker-xxxxx.ap-shanghai.app.tcloudbase.com
   ```
3. 浏览器打开测试 → 手机微信打开测试 → 录入一条数据

#### 第 6 步：发到家庭微信群

```text
爸妈健康记录：https://你的固定域名
点链接录入，早晚各一次。建议置顶。
```

若设置了 `FAMILY_ACCESS_KEY`，链接要带参数：

```text
https://你的固定域名/?key=你设置的随机字符
```

#### 从 CNB 迁移已有数据（一次性）

1. 在 CNB WebIDE 或仅预览环境里执行 `cat data/health.json`，复制全部内容
2. 云托管部署成功后，在管理页重新录入；或联系会操作的人把 JSON 写入挂载的 `/data/health.json`

#### 日常维护

| 情况 | 你要做什么 |
|------|------------|
| 正常使用 | **什么都不用做**，7×24 在线 |
| 改了代码要更新 | 重新 `./scripts/package-cloudrun.sh` → 云托管 **新建版本** 上传 zip |
| 链接突然 404 | 到控制台看服务是否在运行，一般会自动恢复 |

#### 费用说明

微信云托管有免费额度，家庭小规模使用通常很低。具体以 [微信云托管定价](https://cloud.weixin.qq.com/cloudrun/price) 为准。

#### 备选：从 GitHub 自动部署

若不想每次手动 zip，可在云托管 **新建流水线** → 绑定 GitHub 仓库 `Hyden163/elder-health-tracker`、分支 `main`，push 代码后自动构建。首次仍建议用手动上传跑通。

CLI 用户可复制 [`cloudbaserc.example.json`](cloudbaserc.example.json) 为 `cloudbaserc.json` 后执行 `tcb cloudrun deploy`（需先安装 [CloudBase CLI](https://docs.cloudbase.net/cli-v1/install)）。

#### 云托管验收

- [ ] 固定 HTTPS 链接在微信里能打开
- [ ] 老人能录入，子女另一台手机能看到
- [ ] 重新部署后历史数据仍在（已配置 `/data` 存储挂载）

### 部署验收

- [ ] 手机微信能打开 HTTPS 链接
- [ ] 老人能完成一次录入
- [ ] 子女另一台手机刷新能看到新数据
- [ ] 重启或重新部署后，历史数据仍在

## 家庭访问密钥（可选，推荐）

若希望只有家人能访问，在服务器设置环境变量：

```bash
FAMILY_ACCESS_KEY=一串随机字符
```

然后将带密钥的链接发到家庭群：

```text
https://你的域名.com/?key=一串随机字符
```

未设置 `FAMILY_ACCESS_KEY` 时，行为与以前相同（无鉴权）。设置后，所有 API 请求需携带正确的 `key` 参数。

## XML 导出

在趋势区域点击 **「导出 XML」**，可下载当前时间范围内的记录。字段包括：

- id、recordedAt、period、heartRate、systolic、diastolic、spo2、createdAt

适合备份或提供给医疗机构，不建议作为日常在群里传文件的主流程。

## 环境变量一览

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `DATA_DIR` | 数据目录 | `./data` |
| `FAMILY_ACCESS_KEY` | 家庭访问密钥（可选） | 空（不启用） |

## 生产环境兼容性

- 支持 `process.env.PORT`
- 支持 `DATA_DIR` 持久化路径
- 自动创建数据目录和默认 `health.json`
- 可选 `FAMILY_ACCESS_KEY` 链接鉴权

## 后续升级方向

- 多位老人、多个家庭独立链接
- 微信小程序（链接用顺后再做）
- 用 SQLite 或云数据库替代 JSON 文件
- 录入提醒（需公众号或小程序配合）
