-- 撤回全局修改：恢复陈怡静(id=7)；新建「小女孩」仅绑定第1集(episode_id=5)
BEGIN TRANSACTION;

INSERT INTO characters (
  drama_id,
  name,
  role,
  description,
  appearance,
  personality,
  sort_order,
  created_at,
  updated_at
) VALUES (
  4,
  '小女孩',
  '主角',
  '虚拟数据空间中的短发小女孩。在数字粒子海洋中与诞生于涟漪的小象相遇，掌心相触时与暖金色微光产生神秘连接。随后在虚幻数字丛林与小象并肩奔跑，聆听太极四象的古老哲言，对「万物由数据而生」充满错愕与震撼。',
  '二次元唯美动画风。约七八岁小女孩体型，身形娇小匀称。留着干净利落的短发，发丝柔顺，发尾轻盈。面部轮廓柔和，五官清秀精致，双眸清澈明亮、充满好奇。穿着简洁轻便的日常便服或简约裙装，色调以浅蓝、冰白、柔雾青为主，与赛博数字光影环境协调。整体气质纯真、沉静、略带探索欲，无眼镜、无职场装束。',
  '纯真、好奇、沉静、易感',
  1,
  datetime('now'),
  datetime('now')
);

CREATE TEMP TABLE _girl (id INTEGER PRIMARY KEY);
INSERT INTO _girl (id) VALUES (last_insert_rowid());

UPDATE characters SET
  image_url = (SELECT image_url FROM characters WHERE id = 7),
  local_path = (SELECT local_path FROM characters WHERE id = 7),
  reference_images = (SELECT reference_images FROM characters WHERE id = 7),
  updated_at = datetime('now')
WHERE id = (SELECT id FROM _girl);

UPDATE characters SET
  name = '陈怡静',
  role = '主角',
  description = '联创科技员工，负责「四象算力平台 V3.0」项目。凌晨在办公室加班时从噩梦中惊醒，梦中见到流动的数字河流、星河状的算力光网和泛着蓝光的小象。醒来后恍然大悟，迅速在便签上写下「四象」二字，精神面貌从疲惫迷茫转为坚定果敢，随后快步闯入会议室向董事长阐述想法。展现出敏锐的商业直觉和果断的执行力。',
  appearance = '26岁职场女性，留着利落的齐耳短发，发丝柔顺有光泽。面部轮廓清秀，五官精致，戴着一副细框眼镜。身形轻盈矫健，体态匀称。穿着素色衬衫，领口简洁干练，搭配黑色高跟鞋。整体形象干净利落，充满职场女性的专业气质与青春活力。',
  personality = '敏锐、果断、坚韧、富有探索精神',
  image_url = NULL,
  local_path = NULL,
  reference_images = NULL,
  updated_at = datetime('now')
WHERE id = 7 AND drama_id = 4;

UPDATE characters SET
  description = '神秘的数字生命体，从数字粒子海洋的涟漪中诞生。自称''是来寻你的''，与陈怡静掌心相触时产生暖金色微光交融。在虚幻数字丛林中仰头说出''太极生两仪，两仪生四象，四象生八卦，八卦生万物''的古老哲言，最后揭示''万物皆在数据中，亦在你心中''。似乎掌握着某种超越认知的宇宙真理，与陈怡静有着特殊的宿命联系。',
  updated_at = datetime('now')
WHERE id = 8 AND drama_id = 4;

-- 第1集-V2 等恢复为陈怡静
UPDATE episodes SET
  script_content = REPLACE(script_content, '小女孩', '陈怡静'),
  content = REPLACE(content, '小女孩', '陈怡静'),
  updated_at = datetime('now')
WHERE id = 33;

UPDATE storyboards SET
  description = REPLACE(COALESCE(description, ''), '小女孩', '陈怡静'),
  dialogue = REPLACE(COALESCE(dialogue, ''), '小女孩', '陈怡静'),
  image_prompt = REPLACE(COALESCE(image_prompt, ''), '小女孩', '陈怡静'),
  video_prompt = REPLACE(COALESCE(video_prompt, ''), '小女孩', '陈怡静'),
  action = REPLACE(COALESCE(action, ''), '小女孩', '陈怡静'),
  updated_at = datetime('now')
WHERE episode_id = 33;

-- 第1集(episode_id=5)仅保留小女孩文案（若被误改则确保为小女孩）
UPDATE episodes SET
  script_content = REPLACE(script_content, '陈怡静', '小女孩'),
  content = REPLACE(content, '陈怡静', '小女孩'),
  updated_at = datetime('now')
WHERE id = 5;

UPDATE storyboards SET
  description = REPLACE(COALESCE(description, ''), '陈怡静', '小女孩'),
  dialogue = REPLACE(COALESCE(dialogue, ''), '陈怡静', '小女孩'),
  image_prompt = REPLACE(COALESCE(image_prompt, ''), '陈怡静', '小女孩'),
  video_prompt = REPLACE(COALESCE(video_prompt, ''), '陈怡静', '小女孩'),
  action = REPLACE(COALESCE(action, ''), '陈怡静', '小女孩'),
  updated_at = datetime('now')
WHERE episode_id = 5;

-- 第1集关联：陈怡静 -> 小女孩
DELETE FROM episode_characters
WHERE episode_id = 5 AND character_id = 7;

INSERT INTO episode_characters (episode_id, character_id, created_at)
SELECT 5, id, datetime('now') FROM _girl
WHERE NOT EXISTS (
  SELECT 1 FROM episode_characters WHERE episode_id = 5 AND character_id = (SELECT id FROM _girl)
);

UPDATE storyboard_characters
SET character_id = (SELECT id FROM _girl)
WHERE character_id = 7
  AND storyboard_id IN (SELECT id FROM storyboards WHERE episode_id = 5);

SELECT 'characters' AS t, id, name, image_url FROM characters WHERE id IN (7, (SELECT id FROM _girl));
SELECT 'ep5_chars' AS t, c.id, c.name FROM episode_characters ec JOIN characters c ON c.id = ec.character_id WHERE ec.episode_id = 5;
SELECT 'ep33_chars' AS t, c.id, c.name FROM episode_characters ec JOIN characters c ON c.id = ec.character_id WHERE ec.episode_id = 33;

COMMIT;
