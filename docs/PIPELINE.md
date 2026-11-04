# 文章流水线规范（v1.0）

> 适用范围：`dsh-article-studio` 插件产出的所有公众号文章。
> 本规范是硬约束：不满足门禁的产物不允许排版、不允许推送。

## 1. 角色

| 角色 | 负责 | 不负责 |
|---|---|---|
| 人 | 选题方向、终审、最终群发 | 排版、图片下载、草稿箱推送 |
| AI（会话内） | 大纲、正文、配图线索、修订 | 发布决策 |
| Host 插件 | 存储、校验门禁、调用 format/publish、记录 | 生成内容 |

## 2. 目录与命名

每篇文章一个目录，目录名即文章 id（中文可读，前后端一致）：

```
<文章根目录>/<文章 id>/
├ article.json           # 元数据：主题、封面、稿号、阶段、历史
├ draft.md               # 唯一正文来源
├ images/               # 配图（含 manifest.json）
└ out/<输入名>/          # 排版产物（preview.html / article.html / images/）
```

- 文章根目录默认 `D:\others\article\studio`，可在面板「设置」修改；设置存于 `%USERPROFILE%\.dsh\article-studio\settings.json`；
- 图片文件名 `NN-<hash>.<ext>`，按抓取顺序编号；
- 封面字段 `cover` 存相对路径，如 `images/s1.jpg`。

## 3. 阶段与门禁

| 阶段 | 产物 | 门禁（不满足即拒绝） |
|---|---|---|
| 选题 brief | `article.json` | 标题非空 |
| 大纲 outline | — | 可有可无，由 AI 判断 |
| 正文 draft | `draft.md` | 非空、可被 format.py 解析 |
| 配图 images | `images/*` + `images/manifest.json` | **≥ 设置中的最少张数（默认 3）**，且每张有来源记录；**「核心产品」下每个产品小节都必须有对应产品图** |
| 排版 format | `out/.../preview.html` | 上一条通过 + 主题合法；缺产品图会在返回里带上 `warnings` 列表 |
| 审校 review | — | 人工确认（面板「审校通过」或直接不可见） |
| 发布 publish | 草稿箱 media_id | 已完成排版 + 公众号凭据可用 + IP 在白名单 |

## 4. 配图规范

1. **来源**：只从文章 `sourceUrl` 指向的官方页面抓取（`grab` 动作），不抓搜索引擎缩略图；
2. **留痕**：每张图在 `images/manifest.json` 记录 `name / sourceUrl / pageUrl / at / bytes`；
3. **数量**：不少于设置值（默认 3 张）；正文需用 `![](images/xxx.jpg)` 引用，排版才会嵌入；
4. **格式**：正文引用 JPG/PNG；WebP 先转 JPG 再引用，避免公众号不识别；
5. **尺寸**：长边建议 ≥ 1000px；产品图优先官网原图，不用截图裁切冒充产品图；
6. **合规**：官网图片版权归该企业，对外发布需授权或注明来源；截图含第三方肖像/logo 时慎用；
7. **一物一图**：正文每提到一个具体产品（如 Wuji Hand 1.0、T1、S1），该产品都要有自己的配图，不得用同系列其他产品的图顶替；`format` 会扫描「核心产品」下的每个小节，缺图的产品名会出现在返回的 `warnings` 里，面板以 toast 提示；
9. **缺图就扩，不许放弃**：每条产品/新闻必须有图。illImages 按「标题原词 → 去标点关键词 → 前三个词 → 关键词+机器人」逐级扩大查询，命中即采用；

8. **人物与品牌**：公司 Logo、创始人照片可作为版头或人物段配图，但需在 alt 文本里标注来源（官方素材 / 媒体访谈）。

## 5. 排版规范

- 主题来自内置 85 套（`vendor/xiaohu/themes/*.json`），默认 `newspaper`；
- 每次切换主题 = 写入 `article.json` + 调用 `format.py` + 刷新预览，三者不可分开；
- 预览为手机宽度（415px）取景框，呈现公众号真实排版；
- **正文不重复标题**：`format.py` 始终带 `--drop-title`，丢掉 `draft.md` 第一行的 `# 标题`，并关闭 hero 首屏——公众号本身已显示标题。版头位置放品牌图（如 `images/logo.png`、`images/brand.png`）；
- 排版失败必须原样返回脚本错误，不得静默。

## 6. 发布规范

- 凭据：面板「设置」填写 AppID / AppSecret，写入 `vendor/xiaohu/config.json`（已 gitignore）；
- 公众号后台需把**当前出口 IP** 加入白名单，否则返回 `40164`；
- **只有一个发布动作**：推送草稿——直接写公众号草稿箱并返回 media_id，不设演练步骤；
- **群发不在本插件内自动执行**，由人在公众号后台确认；
- 每次推送写入 `article.json.history`。

## 7. 设置项

| 键 | 含义 | 默认 |
|---|---|---|
| root | 文章根目录 | `D:\others\article\studio` |
| minImages | 最少配图张数 | 3 |
| defaultTheme | 新建文章的默认主题 | newspaper |
| wechat.app_id / app_secret / author | 公众号凭据与署名 | 取自现有 config |

## 8. 失败处理

| 情况 | 表现 | 处理 |
|---|---|---|
| 宿主未重启 | 动作返回 `unknown action` | 面板提示「宿主仍旧，请完全退出 DSH」 |
| 配图不足 | `format` 返回「配图不足：需要 N 张」 | 先抓图并写入正文 |
| 抓图失败 | 返回 HTTP 状态或 0 张 | 检查 `sourceUrl` 与网络 |
| 排版失败 | 返回脚本 stderr | 检查 draft.md 语法/图片路径 |
| 发布 40164 | 返回原始 errcode | 公众号后台加白名单 |

## 9. 验收清单（每篇发布前）

- [ ] `article.json` 标题、主题、封面齐全
- [ ] `draft.md` 字数、结构完整（基本信息 / 创始人 / 历程 / 产品 / 分析）
- [ ] `images/` ≥ 3 张且 manifest 有来源
- [ ] 正文引用图片路径正确，预览无破图
- [ ] 已选最终主题并排版
- [ ] 微信公众号后台已把当前出口 IP 加入白名单
- [ ] 推送草稿后到草稿箱确认标题/封面/图片
