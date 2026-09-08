-- 第1集-V2 独立场景：新名称 + 中文 prompt，不共用第1集场景图
BEGIN TRANSACTION;

INSERT INTO scenes (
  drama_id,
  location,
  time,
  prompt,
  storyboard_count,
  status,
  created_at,
  updated_at
) VALUES
(
  4,
  '虚界粒子静海',
  '虚拟黎明',
  '浩瀚数字粒子如静海铺展，细碎冰蓝光点在深海军蓝虚空中缓缓浮动，画面中心淡蓝色同心涟漪层层扩散，顶方一束柔和神光，空灵梦幻，二次元赛博动画风，电影级体积光，16:9 空镜，无人物无文字，8K',
  5,
  'pending',
  datetime('now'),
  datetime('now')
),
(
  4,
  '幽蓝代码丛林',
  '虚拟黄昏',
  '虚幻数字丛林，半透明数据巨树参天林立，枝叶间流淌幽蓝代码光带，光点在空气中漂浮，神秘空灵，二次元赛博动画风，虚拟黄昏氛围，电影级布光，16:9 空镜，无人物无文字，8K',
  5,
  'pending',
  datetime('now'),
  datetime('now')
);

CREATE TEMP TABLE _v2_scenes (sea_id INTEGER, jungle_id INTEGER);
INSERT INTO _v2_scenes (sea_id, jungle_id)
SELECT
  (SELECT id FROM scenes WHERE drama_id = 4 AND location = '虚界粒子静海' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM scenes WHERE drama_id = 4 AND location = '幽蓝代码丛林' ORDER BY id DESC LIMIT 1);

DELETE FROM episode_scenes WHERE episode_id = 33;

INSERT INTO episode_scenes (episode_id, scene_id, created_at)
SELECT 33, sea_id, datetime('now') FROM _v2_scenes
UNION ALL
SELECT 33, jungle_id, datetime('now') FROM _v2_scenes;

UPDATE storyboards SET
  scene_id = (SELECT sea_id FROM _v2_scenes),
  location = REPLACE(REPLACE(COALESCE(location, ''), '数字粒子海洋', '虚界粒子静海'), '数字混沌虚界 → 数字粒子海洋', '数字混沌虚界 → 虚界粒子静海'),
  image_prompt = REPLACE(REPLACE(COALESCE(image_prompt, ''), '数字粒子海洋', '虚界粒子静海'), '「数字粒子海洋」', '「虚界粒子静海」'),
  video_prompt = REPLACE(REPLACE(REPLACE(COALESCE(video_prompt, ''), '数字粒子海洋', '虚界粒子静海'), '数字混沌虚界', '虚界粒子静海'), '虚幻数字丛林', '幽蓝代码丛林'),
  last_frame_image = CASE WHEN storyboard_number = 0 THEN NULL ELSE last_frame_image END,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number IN (0, 1, 2, 3, 4);

UPDATE storyboards SET
  scene_id = (SELECT jungle_id FROM _v2_scenes),
  location = REPLACE(COALESCE(location, ''), '虚幻数字丛林', '幽蓝代码丛林'),
  image_prompt = REPLACE(COALESCE(image_prompt, ''), '虚幻数字丛林', '幽蓝代码丛林'),
  video_prompt = REPLACE(COALESCE(video_prompt, ''), '虚幻数字丛林', '幽蓝代码丛林'),
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number IN (6, 7, 8, 9, 10);

COMMIT;

SELECT s.id, s.location, s.image_url, s.status FROM scenes s
WHERE s.drama_id = 4 AND s.location IN ('虚界粒子静海', '幽蓝代码丛林');
SELECT e.title, s.location FROM episode_scenes es
JOIN episodes e ON e.id = es.episode_id
JOIN scenes s ON s.id = es.scene_id
WHERE es.episode_id IN (5, 33)
ORDER BY es.episode_id, s.id;
SELECT storyboard_number, title, scene_id, substr(location,1,30) FROM storyboards WHERE episode_id=33 ORDER BY storyboard_number;
