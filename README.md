# 老人健康记录应用

这是一个用于老人早晚录入心率、血压（高压/低压）和血氧，并展示近7天/近30天/近90天趋势的网页应用。

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

## 临时分享

如果你想快速分享给老人测试，之前已经使用 `localtunnel` 生成了一个临时链接。这个链接适合短期使用，但不适合长期保留。

## 长期稳定部署建议

要让应用长期稳定可用，需要部署到云端平台，并保证服务持续运行。常见平台包括：

- Render
- Railway
- Heroku
- 其他支持 Node.js 的云服务

## 新增功能：XML 导出

应用已新增“导出 XML”功能，用户可以在趋势图页面点击“导出 XML”按钮，将当前选择时间范围内的数据导出为 XML 文件。

导出的 XML 文件将包含：

- id
- recordedAt
- period
- heartRate
- systolic
- diastolic
- spo2
- createdAt

导出按钮位于趋势图区域，支持近7天/近30天/近90天的数据导出。
### 推荐方式：使用 Render or Railway

1. 在 GitHub 上创建一个仓库。
2. 把当前项目代码提交到仓库：
   ```bash
   git init
   git add .
   git commit -m "初始版本"
   git branch -M main
   git remote add origin <你的仓库地址>
   git push -u origin main
   ```
3. 登录 Render 或 Railway。
4. 新建一个 Web 服务，选择连接你刚才创建的 GitHub 仓库。
5. 配置：
   - 构建命令：`npm install`
   - 启动命令：`npm start`
6. 部署完成后，平台会自动为你生成一个 `https://...` 地址。

### 注意数据存储

当前后端使用 `data/health.json` 作为存储文件。它可以在单实例服务中工作，但如果你希望数据长期稳定不丢失，最好以后升级为真正的数据库（例如 PostgreSQL、MongoDB、或专门的云数据库）。

如果你只想先做长期可用的访问入口，当前方式在平台支持持久化磁盘时也能暂时使用。

## 生产环境兼容性

已为服务器添加以下支持：

- 支持 `process.env.PORT`，适应云服务分配端口
- 自动创建 `data` 目录和默认 `health.json`

## 后续升级方向

- 为每个老人设置单独账号或单独链接
- 让家人查看不同老人的历史数据
- 加入提醒功能，例如早晚提醒录入
- 用真正的云数据库替代本地 JSON 存储
