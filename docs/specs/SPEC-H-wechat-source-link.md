# SPEC-H：微信公众号来源不显示正文，跳转阅读原文

> 状态：✅ 已确定  
> 创建：2026-07-09  
> 作者：zeyuli

---

## 一、问题

微信公众号文章通过 wechat-article-exporter 采集后，正文以 markdown 格式存入 `contentOriginal` 字段，在详情页通过 `react-markdown` 渲染。但微信文章涉及：

1. **版权风险**：全文转载微信公众号内容可能涉及侵权
2. **格式失真**：微信文章的排版（小程序卡片、特殊样式）在 markdown 转换后不可逆丢失
3. **用户习惯**：微信读者习惯在微信客户端阅读原文

## 二、需求

**微信公众号来源的信息，在详情页不展示正文内容，改为显示提示信息并提供跳转链接到原文。**

## 三、约束

- 仅对 `_source === 'wechat'` 的条目生效
- FDA、EMA 等其他来源不受影响，正常显示正文
- 提示信息应清晰说明"请点击阅读原文"
- 原文链接应显式可点击，同时保留底部原有的"阅读原文"按钮

## 四、实现方案

### 4.1 判断逻辑

```typescript
const isWechatSource = event._source === 'wechat' || event.sourceId?.startsWith('wechat-');
```

### 4.2 UI 呈现

在 DetailView 中，当 `isWechatSource` 为 true 时：

1. **隐藏正文区域**（`contentOriginal` / `contentCn` / `contentMd`）
2. **显示信息卡片**，内容为：

```
📱 微信公众号来源

本文来自微信公众号「{sourceName}」，请点击下方按钮查看原文。

[阅读原文]({event.url})
```

- 卡片采用现有项目的 `card` 样式类（浅色背景 + 圆角 + 阴影）
- "阅读原文" 按钮使用 `brand-500` 主色调，target="_blank"
- 底部保留已有的"查看原文"外链按钮（现已在 DetailView 中）

### 4.3 不影响现有功能

- `EventCard.tsx` 中的摘要展示（`aiSummaryCn`）不受影响
- `FilterToolbar.tsx` 分类筛选不受影响
- `analyze.cjs` AI 分析流水线不受影响

### 4.4 文件变更

| 文件 | 改动 |
|------|------|
| `regulatory-hot/components/event/DetailView.tsx` | 加 wechat 判断 + 隐藏正文 + 显示提示卡片 |
| `docs/specs/SPEC-H-wechat-source-link.md` | 本规格文档（新增） |

## 五、验收标准

1. 打开任意 wechat 来源条目详情页，正文区域不显示 markdown 内容
2. 看到提示信息："微信公众号来源，请点击阅读原文"
3. "阅读原文" 链接可点击，新窗口打开原文
4. FDA 等非 wechat 条目详情页正常显示正文（不受影响）
5. 首页 / all 页的卡片摘要正常显示
