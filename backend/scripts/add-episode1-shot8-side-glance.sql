-- 第1集(episode_id=5)：镜7与镜8之间插入「相视而笑」(3s)
BEGIN TRANSACTION;

-- 后移镜号：自高到低避免冲突
UPDATE storyboards SET storyboard_number = 14, updated_at = datetime('now') WHERE id = 130 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 13, updated_at = datetime('now') WHERE id = 129 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 12, updated_at = datetime('now') WHERE id = 128 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 11, updated_at = datetime('now') WHERE id = 127 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 10, updated_at = datetime('now') WHERE id = 126 AND episode_id = 5;
UPDATE storyboards SET storyboard_number = 9,  updated_at = datetime('now') WHERE id = 125 AND episode_id = 5;

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
  10,
  8,
  '相视而笑',
  '虚幻数字丛林',
  '虚拟黄昏',
  '中景',
  '侧拍',
  '跟拍平移',
  '奔跑途中两人同步侧头望向对方，短发小女孩眉眼弯起露出清浅笑意，小象晃了晃耳朵灵动回应，气流卷起的粒子在两人身侧拉出流动的光带',
  '相视而笑后奔跑渐缓，即将驻足仰望',
  '梦幻、轻盈、温柔；粒子光带流动飘逸',
  '奔跑途中同步侧头相视，女孩清浅笑意，小象晃耳回应，身侧粒子拉出流动光带',
  '二次元唯美动画中景，短发女孩与蓝色数字小象并肩奔跑中同步侧头相视，女孩笑意温柔，小象灵动晃耳，身侧环绕流动的粒子光带，动态轻盈飘逸，赛博数字丛林背景，梦幻光影质感',
  '0-3秒：<location>虚幻数字丛林</location>，中景侧拍跟拍平移，<role>小女孩</role>与<role>小象</role>并肩奔跑中同步侧头相望，女孩眉眼弯起露出清浅笑意，小象晃了晃耳朵灵动回应，气流卷起的粒子在两人身侧拉出流动的光带。',
  3,
  'pending',
  datetime('now'),
  datetime('now')
);

-- 关联角色：小象(8)、小女孩(44)
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 8 FROM storyboards WHERE episode_id = 5 AND storyboard_number = 8 ORDER BY id DESC LIMIT 1;
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 44 FROM storyboards WHERE episode_id = 5 AND storyboard_number = 8 ORDER BY id DESC LIMIT 1;

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
奔跑途中两人同步侧头相望，女孩眉眼弯起露出清浅笑意，小象晃耳灵动回应，粒子在身侧拉出流动光带。

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
WHERE episode_id = 5 AND deleted_at IS NULL AND storyboard_number BETWEEN 7 AND 10
ORDER BY storyboard_number;
