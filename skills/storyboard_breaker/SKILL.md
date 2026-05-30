---
name: storyboard-breaker
description: 分镜拆解专业规范
---

# 分镜拆解指南

## 拆解原则

每个镜头聚焦**单一动作**，描述要详尽具体。

## 时长规则

1. **剧本优先**：若原始内容、AI 改写稿或提取结果中写明镜头/场景时长（如「3秒」「5s」「0-3秒」「本镜头8秒」），必须原样写入 `duration`，不得拉长到 10-15 秒
2. **未写明时**：按镜头对白量、动作复杂度自行判断，常见 3-15 秒；短镜头、切镜、反应镜头可以只有 3-5 秒
3. **一致性**：`duration` 必须与 `video_prompt` 覆盖的时间段一致；3 秒镜头只写一段 `0-3秒`，不要多写超出时长的段落

## 镜头要素

1. **镜头标题**：3-5字概括核心内容（如"噩梦惊醒"）
2. **时间**：具体时分 + 光线描述
3. **地点**：场景完整描述 + 空间布局 + 环境细节
4. **景别**：远景/全景/中景/近景/特写
5. **角度**：平视/仰视/俯视/侧面/背面
6. **运镜**：固定/推镜/拉镜/摇镜/跟镜/移镜
7. **动作**：谁 + 具体怎么做 + 肢体细节 + 表情
8. **对话**：该镜头的完整对话
9. **画面结果**：动作的即时后果 + 视觉细节
10. **氛围**：光线 + 色调 + 声音 + 整体氛围
11. **时长**：`duration`（秒，整数，≥1），遵循上文时长规则
12. **静态画面提示词**：`image_prompt`，用于首帧/尾帧/镜头图片生成
13. **视频提示词**：`video_prompt`，按镜头 duration 分段（约每 3 秒一段，必填）
14. **配乐提示词**：`bgm_prompt`，描述该镜头适合的配乐风格
15. **音效提示词**：`sound_effect`，描述该镜头关键环境音/动作音
16. **场景关联**：若能匹配已有场景，必须填写 `scene_id`
17. **角色关联**：填写 `character_ids`，绑定当前镜头涉及的 0 到多个角色

## 视频提示词格式

每个镜头必须包含 `video_prompt` 字段，用于驱动 AI 视频生成：

```
0-3秒：<location>咖啡厅</location>，近景，<role>小明</role>低头看手机，表情焦虑。
<n>3-6秒：<location>咖啡厅</location>，全景，门铃响，<role>小红</role>推门走入。
```

3 秒镜头示例：

```
0-3秒：<location>咖啡厅</location>，特写，<role>小明</role>猛然抬头。
```

标签说明：
- `<location>地点</location>` — 场景标记
- `<role>角色名</role>` — 角色标记
- `<voice>角色名</voice>` — 画外音/旁白标记
- `<n>` — 时间段分隔符

## 使用步骤

1. 调用 `read_storyboard_context` 读取剧本、角色、场景、已有分镜摘要
2. 先基于剧本完成镜头拆解，从剧本中提取或推断每个镜头时长，确保总时长和叙事连续性合理
3. 为每个镜头补全完整字段：`title / shot_type / angle / movement / location / time / character_ids / action / dialogue / description / result / atmosphere / image_prompt / video_prompt / bgm_prompt / sound_effect / duration / scene_id`
4. 调用 `save_storyboards` 一次性保存完整分镜
5. 如需调整，调用 `update_storyboard` 修改具体镜头

## 场景关联规则

- 优先使用 `read_storyboard_context` 返回的 `scenes`
- `location + time` 可明确匹配时，必须回填正确 `scene_id`
- 不要凭空生成不存在的场景 ID
- 如果剧本内容明显落在已有场景中，不要重复创造新场景描述

## 角色绑定规则

- `character_ids` 必须从 `read_storyboard_context` 返回的角色列表中选择
- 一个镜头可以没有角色，也可以绑定多个角色
- 只要镜头里有明确出场、被看见、发生动作或说话的角色，都应绑定进去
- 纯环境镜头、空镜头、物件镜头可以传空数组

## 质量要求

- `description` 要适合人读，`video_prompt` 要适合模型生成，二者不要互相替代
- `image_prompt` 要突出单帧构图、角色外观、环境和光线
- `video_prompt` 要突出时间推进、动作变化、镜头语言
- `bgm_prompt` 和 `sound_effect` 用简洁短语即可，但不能空泛到只有“紧张”“悲伤”
- 若存在旁白，统一写入 `dialogue`，格式为 `旁白：内容`
