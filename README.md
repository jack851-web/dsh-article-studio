# dsh-article-studio

DeepSeek Harness 侧栏的**文章流水线**：写作 → 配图 → 排版 → 审校 → 推送公众号草稿，一个 tab 里完成。

> 当前版本 0.1.0（M2 单篇闭环 + 内置排版引擎）。

## 能力

| 模块 | 说明 |
|---|---|
| 侧栏 tab | 右下角「文章」按钮打开；列表 + 详情 + 阶段导轨 + 校样预览 |
| 阶段状态机 | brief → outline → draft → images → format → review → publish，状态落盘 `article.json` |
| 排版 | 内置 `vendor/xiaohu`（85 个主题、format.py / publish.py），不依赖外部目录 |
| 预览 | Host 路由注入 `<base>`，图片相对路径正常加载 |
| 发布 | 推送公众号草稿箱（需 appid/secret）；IP 白名单不通过时原样返回错误 |
| 存储 | `D:\others\article\studio\<id>\`（可用 `ARTICLE_STUDIO_HOME` 覆盖） |

## 安装

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

然后**完全退出并重启 DSH**。

打开方式：在 DSH 右侧的「文件」面板里点开工作区的 `文章流水线.astudio`，插件会把面板作为**右侧文档 tab** 打开，聊天区不受影响。该文件只是入口标记，数据仍在 `D:\others\article\studio`。

卸载：`uninstall.ps1`。

## 流程规则（强制）

1. **必须配图**：每篇文章至少 3 张图，`format` 前由 Host 校验，不足直接拒绝并说明缺几张；
2. **图必须有出处**：`grab` 从文章 `sourceUrl` 抓取官网图片，写入 `images/` 并在 `images/manifest.json` 记录来源页、图片地址与时间；
3. **正文要引用**：图片需以 `![](images/xxx.jpg)` 写进 `draft.md` 的对应章节，排版才会嵌入正文；
4. **排版产物**：`out/<输入名>/preview.html` 自带「复制到微信」，与技能原版一致；
5. **发布**：`publish` 只推送草稿箱，群发仍需人工在公众号后台确认。

## 配置

- 排版：`vendor/xiaohu/config.json` 自动从 `%USERPROFILE%\.dsh\article-studio\config.json` 或 `config.example.json` 生成；
- 发布：在 `config.json` 的 `wechat.app_id` / `wechat.app_secret` 填入公众号凭据，并在公众号后台把当前出口 IP 加入白名单；
- 文章目录：默认 `D:\others\article\studio`，可用环境变量 `ARTICLE_STUDIO_HOME` 改。

## 接口

Host 注册前缀路由 `/dsh-article-studio/`：

```
POST /dsh-article-studio/rpc
  { "action": "list" }
  { "action": "get", "id": "..." }
  { "action": "create", "title": "..." }
  { "action": "update", "id": "...", "title": "...", "author": "...", "group": "...", "cover": "images/x.jpg" }
  { "action": "set", "id": "...", "stage": "review", "status": "done", "note": "" }
  { "action": "format", "id": "...", "theme": "newspaper" }
  { "action": "publish", "id": "..." }        # 直接写公众号草稿箱，无演练步骤

GET /dsh-article-studio/preview/<id>          # 最新 preview.html（注入 base）
GET /dsh-article-studio/preview/<id>/<path>   # 预览资源
```

## 已知限制

- 发布依赖公众号 API：IP 不在白名单会返回 `errcode 40164`，界面会显示原始错误；
- 批量生产、图片右键（换一张/按新要求重搜）、官网取材还在 M3 路上；
- 侧栏 tab 注册 API 若在某个 DSH 版本变化，插件会降级为无 UI 而不影响启动。

## 目录

```
lib/index.js      Host：存储、排版/发布桥、预览路由
lib/client.js     Client：tab、列表/详情、操作按钮
vendor/xiaohu/    内置排版引擎（scripts/themes/templates/cover）
```

## License

MIT
