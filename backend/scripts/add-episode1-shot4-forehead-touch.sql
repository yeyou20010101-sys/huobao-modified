-- 第1集(episode_id=5)：镜3与镜4之间插入「额际温存」(3s)
BEGIN TRANSACTION;

-- 后移镜号：自高到低避免冲突
UPDATE storyboards SET storyboard_number = 13, updated_at = datetime('now') WHERE id = 130 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 12, updated_at = datetime('now') WHERE id = 129 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 11, updated_at = datetime('now') WHERE id = 128 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 10, updated_at = datetime('now') WHERE id = 127 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 9,  updated_at = datetime('now') WHERE id = 126 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 8,  updated_at = datetime('now') WHERE id = 125 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 7,  updated_at = datetime('now') WHERE id = 124 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 5,  updated_at = datetime('now') WHERE id = 122 AND episode_id = 5;

INSERT INTO storyboards (
  episode_id,
  scene_id,
  storyboard_number,
  title,
  location,
  time,
  shot_type,
  angle,
  movement,
  action,
  result,
  atmosphere,
  description,
  image_prompt,
  video_prompt,
  duration,
  status,
  created_at,
  updated_at
) VALUES (
  5,
  9,
  4,
  '额际温存',
  '数字粒子海洋',
  '虚拟黎明',
  '近景',
  '平视',
  '慢移',
  '小女孩指尖轻柔落在小象圆润的额头，小象惬意地眯起澄澈眼眸，脑袋轻轻蹭向女孩掌心，周身的淡蓝色光晕随之漾开细碎星芒状光粒',
  '亲昵互动建立信任，小象完全放松，自然趋近女孩掌心，便于衔接掌心相触',
  '治愈、温柔、亲昵；冷暖柔光交织，冰蓝星芒轻漾',
  '陈怡静指尖轻抚小象额头，小象眯眼惬意蹭向掌心，周身冰蓝光粒漾开',
  '16:9 二次元唯美动画近景，女孩指尖轻抚蓝色数字小象的额头，小象眯眼惬意蹭向掌心，周身飘散细碎冰蓝光粒，冷暖柔光交织碰撞，治愈温柔氛围，细腻毛发与肌肤纹理，电影级柔和光影',
  '0-3秒：<location>数字粒子海洋</location>，近景慢移，<role>小女孩</role>指尖轻柔落在<role>小象</role>圆润额头，小象惬意眯起澄澈眼眸，脑袋轻轻蹭向女孩掌心，周身淡蓝光晕漾开细碎星芒状光粒。',
  3,
  'pending',
  datetime('now'),
  datetime('now')
);

-- 关联角色：小象(8)、小女孩(44)
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 8 FROM storyboards WHERE episode_id = 5 AND storyboard_number = 4 ORDER BY id DESC LIMIT 1;
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 44 FROM storyboards WHERE episode_id = 5 AND storyboard_number = 4 ORDER BY id DESC LIMIT 1;

-- 更新剧本：镜3–5 段落
UPDATE episodes SET
  script_content = '## S01 | 内景 · 数据空间 | 虚拟黎明

【镜0–1】无对白
宏大虚空里数据流缓缓流动，粒子海中心短暂留出叠字空间（后期横排「四象」淡入又淡出）。
随后光点加速向心汇聚，形成螺旋数据潮汐；潮汐中心柔光核里，小象轮廓由粒子凝聚成形，尚未睁眼。

【镜3–5】
小象睁开澄澈眼眸，朝前方短发小女孩稳步走去。
小女孩指尖轻柔落在小象圆润额头，小象惬意眯眼，脑袋轻轻蹭向掌心，周身淡蓝光晕漾开细碎星芒。
小象抬起象鼻，轻轻贴上女孩掌心。接触处，暖金色微光悄然涌动。

小女孩：（微怔，低声）你……是谁？
小象：（轻晃象鼻，温和）跟我来。

## S02 | 外景 · 数字丛林 | 虚拟黄昏

虚幻数据树木林立，幽蓝代码在枝叶间流淌。
小女孩与小象并肩奔跑几步，风扬起她的短发与周围光点。

两人停下。小象仰头，神态空灵而古老。

小象：（悠远）太极生两仪，两仪生四象。四象生八卦，八卦生万物。

小女孩：（瞳孔微缩）万物……由你而生？

小象：（转头回望，俏皮）答案，就在你眼前。

话音落下，一道纯白强光骤然划破空间，四周迷雾瞬间消散。光芒中央，「四象」二字以立体发光姿态赫然浮现。

—— 切黑 / 淡出 ——',
  updated_at = datetime('now')
WHERE id = 5;

COMMIT;

-- 校验
SELECT storyboard_number, title, duration, substr(description, 1, 50) AS desc_preview
FROM storyboards
WHERE episode_id = 5 AND deleted_at IS NULL AND storyboard_number BETWEEN 3 AND 6
ORDER BY storyboard_number;
