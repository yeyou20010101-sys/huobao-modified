-- 第五集：添加葛良德、格格(诺尔金) 角色 + 分镜 9/10（参照镜 4-8 solo 近景模板）
-- episode_id=30, drama_id=4, scene_id=25

BEGIN TRANSACTION;

-- 1. 新增角色
INSERT INTO characters (drama_id, name, role, description, appearance, sort_order, created_at, updated_at)
VALUES (
  4,
  '葛良德',
  '配角',
  '市场部七部部长，会议开场在座研判行业报表。',
  '中年男性，约四十七岁，身形敦实，体态端正。面部轮廓硬朗，眉宇间透着市场研判者的审慎与沉稳。短发整齐深色系。穿着深灰色商务西装，内搭浅色衬衫，领带规整，整体形象专业严谨，具备部门负责人的稳重气质。',
  18,
  datetime('now'),
  datetime('now')
);

INSERT INTO characters (drama_id, name, role, description, appearance, sort_order, created_at, updated_at)
VALUES (
  4,
  '格格',
  '配角',
  '集团董事长助理（诺尔金），会议前梳理流程与重点，静坐待命。',
  '青年女性，约二十八岁，身形匀称，体态端庄。面容清秀，五官柔和，眼神沉静专注。长发低盘利落，穿着深色职业套装，内搭白色衬衫，佩戴简约耳饰，整体形象干练沉稳，透着董事长助理的专业与分寸感。',
  19,
  datetime('now'),
  datetime('now')
);

-- 2. 绑定本集角色（提取/角色列表可见）
INSERT INTO episode_characters (episode_id, character_id, created_at)
SELECT 30, id, datetime('now') FROM characters WHERE drama_id = 4 AND name = '葛良德' AND deleted_at IS NULL
  AND id NOT IN (SELECT character_id FROM episode_characters WHERE episode_id = 30);

INSERT INTO episode_characters (episode_id, character_id, created_at)
SELECT 30, id, datetime('now') FROM characters WHERE drama_id = 4 AND name = '格格' AND deleted_at IS NULL
  AND id NOT IN (SELECT character_id FROM episode_characters WHERE episode_id = 30);

-- 3. 镜 9 及以后顺延 +2
UPDATE storyboards SET storyboard_number = 17, updated_at = datetime('now') WHERE episode_id = 30 AND id = 283;
UPDATE storyboards SET storyboard_number = 16, updated_at = datetime('now') WHERE episode_id = 30 AND id = 282;
UPDATE storyboards SET storyboard_number = 15, updated_at = datetime('now') WHERE episode_id = 30 AND id = 281;
UPDATE storyboards SET storyboard_number = 14, updated_at = datetime('now') WHERE episode_id = 30 AND id = 280;
UPDATE storyboards SET storyboard_number = 13, updated_at = datetime('now') WHERE episode_id = 30 AND id = 279;
UPDATE storyboards SET storyboard_number = 12, updated_at = datetime('now') WHERE episode_id = 30 AND id = 302;
UPDATE storyboards SET storyboard_number = 11, updated_at = datetime('now') WHERE episode_id = 30 AND id = 301;

-- 4. 新镜 9：葛良德
INSERT INTO storyboards (
  episode_id, scene_id, storyboard_number, title, description, shot_type, angle, movement,
  action, atmosphere, image_prompt, video_prompt, location, time, duration, status, created_at, updated_at
) VALUES (
  30, 25, 9,
  '葛良德研判',
  '葛良德端坐席位，摊开市场行业报表凝神研判。',
  '近景特写',
  '平视略偏左，浅景深局部裁切',
  '固定',
  '葛良德端坐席位，手中摊开市场行业报表，凝神翻看，研判行业趋势，全程专注审慎。',
  '专注、审慎，市场研判的静默张力。',
  '【无满座要求】近景特写，平视略偏左。葛良德坐席位上手中摊开市场行业报表，凝神翻看研判，神情专注审慎；画面主体为面部、手部与报表边缘，仅保留面前约40cm局部桌沿。构图严格裁切：不展示长桌远端、不展示桌面对角延伸、不展示对称全景；背景仅限肩后浅景深虚化的侧窗冷光、墙面与模糊光斑，无需其他参会者人影。禁止无椅子的空桌区域、禁止清晰第二人脸',
  '0-3秒：<location>会议室</location>近景，<role>葛良德</role>手中摊开市场行业报表凝神翻看，专注审慎，镜头固定。',
  '会议室',
  '清晨',
  3,
  'pending',
  datetime('now'),
  datetime('now')
);

-- 5. 新镜 10：格格
INSERT INTO storyboards (
  episode_id, scene_id, storyboard_number, title, description, shot_type, angle, movement,
  action, atmosphere, image_prompt, video_prompt, location, time, duration, status, created_at, updated_at
) VALUES (
  30, 25, 10,
  '格格待命',
  '格格静坐一旁，梳理会议流程，眼神沉静待命。',
  '近景特写',
  '平视略偏右，浅景深局部裁切',
  '固定',
  '格格静坐席位一旁，身姿端正，提前梳理会议流程与重点事项，眼神沉静，随时待命配合会议推进。',
  '沉静、有序，助理备会的专业感。',
  '【无满座要求】近景特写，平视略偏右。格格静坐席位上身姿端正，手持会议流程资料梳理重点，眼神沉静；画面主体为面部、手部与资料边缘，仅保留面前约40cm局部桌沿。构图严格裁切：不展示长桌远端、不展示会议室深处；背景仅限浅景深虚化的墙面与侧窗光斑，无需其他参会者人影。禁止清晰第二人脸',
  '0-3秒：<location>会议室</location>近景，<role>格格</role>静坐席位端正梳理会议流程资料，眼神沉静，镜头固定。',
  '会议室',
  '清晨',
  3,
  'pending',
  datetime('now'),
  datetime('now')
);

-- 6. 分镜角色绑定（各 1 人）
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT s.id, c.id
FROM storyboards s, characters c
WHERE s.episode_id = 30 AND s.storyboard_number = 9 AND c.drama_id = 4 AND c.name = '葛良德' AND c.deleted_at IS NULL;

INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT s.id, c.id
FROM storyboards s, characters c
WHERE s.episode_id = 30 AND s.storyboard_number = 10 AND c.drama_id = 4 AND c.name = '格格' AND c.deleted_at IS NULL;

COMMIT;
