# 饮食建议改造方案

## 目标

将现有“饮食建议”从简单的食材、心情、备注输入，升级为一个面向实际做饭决策的结构化流程：

- 用户提交清晰的做饭目标和短期状态。
- 各 Agent 第一轮以“推荐食谱”为目标发表意见。
- 老己最终输出可执行菜单、每道菜教程、总预估做饭时间。
- 数据结构能够本地 SQLite 运行，并方便迁移到 Supabase。

## 前端短期状态表单

建议将右侧栏饮食建议输入区改成结构化表单。

### 必填字段

1. 做饭目标
   - 示例：一人晚餐、两人两菜一汤、三人便当、快速早餐。
   - 可以用快捷选项加文字输入。

2. 现有食材
   - 使用“常用食材选项卡 + 文字补充”的模式。
   - 常用选项示例：鸡蛋、青菜、米饭、豆腐、番茄、牛奶、燕麦、鱼肉、鸡胸肉、土豆、面条、虾、蘑菇。
   - 文字补充示例：还有半盒豆腐、一点葱、昨天剩的米饭。

### 可选字段

1. 心情
   - 使用“心情选项卡 + 文字补充”的模式。
   - 选项示例：疲惫、压力大、想吃热乎的、想吃清淡、想吃重口、没胃口、想被安慰。

2. 留给做饭的时间
   - 示例：10 分钟、20 分钟、30 分钟、45 分钟以上。

3. 特别想吃的菜
   - 自由输入。
   - 示例：番茄味、想吃面、想吃辣一点、想喝汤。

4. 饮食限制或偏好补充
   - 示例：不要辣、少油、不想洗太多锅、想带饭、不要太甜。

5. 厨具条件
   - 示例：炒锅、电饭煲、空气炸锅、微波炉、蒸锅。

## 前端数据类型建议

```ts
type CookingRequest = {
  goal: string
  ingredients: string[]
  ingredientNote: string
  moodTags: string[]
  moodNote: string
  timeBudget: string
  craving: string
  constraints: string
  tools: string[]
}
```

右侧栏里的饮食建议记录不再只保存 `ingredients/mood/note`，而是保存：

```ts
type SuggestionRecord = {
  id: string
  createdAt: string
  requestPayload: CookingRequest
  summary: string
  decision?: RecipeDecision
}
```

旧字段 `ingredients/mood/note` 可以保留，用于兼容现有缩略展示。

## 后端请求结构

现有 `/decide` 和 `/decide/stream` 可以继续保留，但前端应传入结构化上下文：

```json
{
  "user_input": "做饭目标：两人两菜一汤\n现有食材：鸡蛋、番茄、青菜、豆腐\n心情：疲惫，想吃热乎的\n时间预算：30分钟\n特别想吃：番茄味\n限制：少油，不要太辣\n厨具：炒锅、电饭煲",
  "context": {
    "profile": {},
    "profile_prompt": "...",
    "short_term_state": {
      "goal": "两人两菜一汤",
      "ingredients": ["鸡蛋", "番茄", "青菜", "豆腐"],
      "ingredientNote": "",
      "moodTags": ["疲惫", "想吃热乎的"],
      "moodNote": "",
      "timeBudget": "30分钟",
      "craving": "番茄味",
      "constraints": "少油，不要太辣",
      "tools": ["炒锅", "电饭煲"]
    }
  }
}
```

这样可以减少 Agent 对自由文本的误解，也能让未来数据库和页面详情展示更稳定。

## Agent 第一轮改造

第一轮不再只讨论“吃不吃”或泛泛健康建议，而是统一以“提出食谱推荐”为目标。

每个 Agent 第一轮都应输出：

- 推荐菜或菜单方向。
- 推荐理由。
- 与用户长期状态的关系。
- 与本次短期状态的关系。
- 时间可行性。
- 风险或注意事项。

### 各 Agent 分工

1. 老中医
   - 关注寒热温凉、脾胃状态、食材性味。
   - 输出适合体质和当下状态的菜品组合。

2. 营养师
   - 关注蛋白质、碳水、蔬菜、油盐、热量结构。
   - 输出更均衡的菜单方案。

3. 情绪疗愈师
   - 关注心情、满足感、进食动机。
   - 推荐能安慰情绪但不过度放纵的菜。

4. 快乐分享
   - 关注口味满足、好吃程度、仪式感。
   - 让菜单更有吸引力。

5. 自律分享
   - 关注时间控制、少油少盐、执行难度。
   - 避免菜单过于复杂。

6. 老己
   - 最终综合各方意见，输出完整食谱方案。

## 老己最终输出结构

建议将最终 JSON 改成食谱导向格式。

```json
{
  "summary_reason": "为什么推荐这套菜单的总结版原因",
  "recommended_menu": {
    "title": "30分钟两菜一汤",
    "servings": "2人",
    "estimated_time": "30分钟",
    "dishes": [
      {
        "name": "番茄豆腐蛋汤",
        "reason": "热乎、补蛋白、符合疲惫状态",
        "ingredients": ["番茄", "豆腐", "鸡蛋", "葱"],
        "steps": [
          "番茄切块，豆腐切小块，鸡蛋打散",
          "锅中少油炒番茄出汁",
          "加水煮开后放豆腐",
          "淋入蛋液，调盐，撒葱花"
        ],
        "time": "12分钟"
      }
    ]
  },
  "prep_plan": [
    "先煮汤底",
    "汤煮开时处理青菜",
    "最后快炒青菜"
  ],
  "nutrition_note": "蛋白质和蔬菜足够，主食按饥饿程度补半碗米饭",
  "mindset_note": "疲惫时先吃热乎稳定的一餐，不追求复杂",
  "today_good": "热乎清淡",
  "today_bad": "复杂重油",
  "action_index": 8,
  "avatar_state": "stable"
}
```

## 前端展示建议

饮食建议生成完成后，详情弹窗应展示：

- 顶部：菜单标题、适合几人、总预估时间。
- 总结原因：为什么推荐这套菜单。
- 推荐菜单：每道菜独立卡片。
- 每道菜卡片包含：
  - 菜名
  - 推荐理由
  - 所需食材
  - 分步骤教程
  - 单菜预计时间
- 备菜顺序或执行计划。
- 营养提示。
- 心态提示。

右侧栏缩略记录仍按当天时间倒序显示。点击缩略记录打开完整食谱详情。

## 数据库改造建议

当前本地 SQLite 和未来 Supabase 都建议在 `diet_suggestions` 中增加完整输入字段。

### SQLite

```sql
ALTER TABLE diet_suggestions ADD COLUMN request_payload TEXT;
```

### Supabase/Postgres

```sql
ALTER TABLE public.diet_suggestions
ADD COLUMN IF NOT EXISTS request_payload jsonb;
```

保留旧字段：

- `ingredients`
- `mood`
- `note`
- `decision`
- `score`

新增字段：

- `request_payload`

这样旧页面缩略展示继续可用，完整结构化输入和最终食谱都可以保存在 JSON 中。

## 实施顺序

1. 前端改造表单结构。
   - 新增 `CookingRequest`。
   - 必填校验：做饭目标、现有食材。
   - 生成结构化 `user_input` 和 `context.short_term_state`。

2. 后端数据库增加 `request_payload`。
   - 本地 SQLite schema 更新。
   - Supabase schema 同步更新。

3. 修改各 Agent prompt。
   - 第一轮统一要求以食谱推荐为目标。
   - 输出推荐菜、理由、注意事项、时间可行性。

4. 修改老己最终总结 prompt。
   - 输出详细菜单 JSON。
   - 包含每道菜教程和总预估时间。

5. 修改前端饮食建议详情弹窗。
   - 展示完整菜单、步骤、时间、营养和心态提示。

6. 验证。
   - 注册用户。
   - 生成当天饮食建议。
   - 右侧栏只显示当天建议。
   - 左侧日历对应日期出现建议标记。
   - 点击日期可看到当天建议缩略信息。
   - 点击建议可看到完整食谱。
