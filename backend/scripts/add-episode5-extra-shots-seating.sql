-- 插入王英姿、王沈样分镜，顺延后续编号，并写入座次化 image_prompt

BEGIN TRANSACTION;

-- 7 及以后先顺延 +2
UPDATE storyboards SET storyboard_number = 15, updated_at = datetime('now') WHERE id = 283;
UPDATE storyboards SET storyboard_number = 14, updated_at = datetime('now') WHERE id = 282;
UPDATE storyboards SET storyboard_number = 13, updated_at = datetime('now') WHERE id = 281;
UPDATE storyboards SET storyboard_number = 12, updated_at = datetime('now') WHERE id = 280;
UPDATE storyboards SET storyboard_number = 11, updated_at = datetime('now') WHERE id = 279;
UPDATE storyboards SET storyboard_number = 10, updated_at = datetime('now') WHERE id = 302;
UPDATE storyboards SET storyboard_number = 9,  updated_at = datetime('now') WHERE id = 301;

-- 新镜 7：王英姿
INSERT INTO storyboards (
  episode_id, scene_id, storyboard_number, title, description, shot_type, angle, movement,
  action, result, atmosphere, image_prompt, video_prompt, bgm_prompt, sound_effect,
  location, time, duration, status, created_at, updated_at
) VALUES (
  30, 25, 7, '王英姿记录', '王英姿坐左侧中席，手持记录本专注整理。', '近景', '平视', '固定',
  '王英姿端坐左侧中席，手持会议记录本认真整理，神情专注细致。', NULL, '有序、专业，幕后记录的踏实感。',
  '【会议桌座次】八人长方形会议桌，上座董事长、右侧于总/黄宇哲/成立军、下座预留陈总、左侧曹总/王英姿/王沈样。【本镜主角席位】王英姿：左侧中席，面向长桌右侧。近景平视，王英姿坐左侧中席手持记录本，面部与手部清晰；上下相邻席位为虚焦参会者肩背剪影，禁止空椅，禁止清晰第二人脸',
  '0-3秒：<location>会议室</location>近景，<role>王英姿</role>坐左侧中席整理记录本，专注细致，镜头固定。',
  '极低频弦乐，平稳持续。', '纸张翻动、笔轻触纸面。',
  '会议室', '清晨', 3, 'pending', datetime('now'), datetime('now')
);

-- 新镜 8：王沈样
INSERT INTO storyboards (
  episode_id, scene_id, storyboard_number, title, description, shot_type, angle, movement,
  action, result, atmosphere, image_prompt, video_prompt, bgm_prompt, sound_effect,
  location, time, duration, status, created_at, updated_at
) VALUES (
  30, 25, 8, '王沈样调试', '王沈样在左侧上席附近白板旁调试投影。', '近景', '平视', '固定',
  '王沈样站立白板旁专注调试投影设备，手指调整按键，神情认真。', NULL, '技术筹备、有序专业。',
  '【会议桌座次】八人长方形会议桌，上座董事长、右侧于总/黄宇哲/成立军、下座预留陈总、左侧曹总/王英姿/王沈样。【本镜主角席位】王沈样：左侧上席区域/白板旁，面向投影与白板。近景，王沈样站白板侧调试投影，面部与手部清晰；背景左侧上席与相邻席位为虚焦人影，禁止空椅，禁止清晰第二人脸',
  '0-3秒：<location>会议室</location>近景，<role>王沈样</role>站白板旁调试投影设备，专注认真，镜头固定。',
  '极低频弦乐，平稳持续。', '设备按键轻响、空调低鸣。',
  '会议室', '清晨', 3, 'pending', datetime('now'), datetime('now')
);

INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 16 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 7;
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 17 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 8;

-- 更新镜 1-6、9-10 座次化 image_prompt
UPDATE storyboards SET image_prompt = '【会议桌座次】八人长方形会议桌，上座董事长、右侧于总/黄宇哲/成立军、下座预留陈总、左侧曹总/王英姿/王沈样。全景平视，长桌两侧坐满参会者均为浅景深虚焦，仅肩背剪影无清晰人脸；下座可显示预留空席。侧窗冷光，禁止除虚影外大面积空无人皮椅', shot_type = '全景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 1;

UPDATE storyboards SET image_prompt = '【会议桌座次】八人长方形会议桌，上座董事长。【本镜主角席位】董事长：上座主位，面向长桌与下座。中近景略仰，董事长坐上座椅内双手交叉于桌沿，清晰锐利；画面左右为虚焦参会者肩背（于总方向在画面右侧），禁止空椅，禁止除董事长外清晰人脸', shot_type = '中近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 2;

UPDATE storyboards SET image_prompt = '【会议桌座次】右侧上席为于总（从上座顺时针第一席）。【本镜主角】于总坐右侧上席看笔记本，中近景从左前方 45 度拍摄，面部清晰；上座与右中席方向虚焦人影，禁止空椅，禁止清晰第二人脸', shot_type = '中近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 3;

UPDATE storyboards SET image_prompt = '【会议桌座次】右侧中席为黄宇哲（从上座顺时针第二席）。【本镜主角】黄宇哲坐右侧中席低头看报表，近景正前方偏左，面部清晰；右上下相邻席虚焦肩背，禁止空椅，禁止清晰第二人脸', shot_type = '近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 4;

UPDATE storyboards SET image_prompt = '【会议桌座次】右侧下席为成立军（从上座顺时针第三席）。【本镜主角】成立军坐右侧下席抱资料沉思，近景左前方，面部清晰；相邻席虚焦人影，禁止空椅，禁止清晰第二人脸', shot_type = '近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 5;

UPDATE storyboards SET image_prompt = '【会议桌座次】左侧下席为曹总（从下座顺时针第一席）。【本镜主角】曹总坐左侧下席转笔观察，近景右前方，面部清晰；对侧与相邻席虚焦肩背，禁止空椅，禁止清晰第二人脸', shot_type = '近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 6;

UPDATE storyboards SET image_prompt = '【会议桌座次】陈总入场前下座预留。【本镜主角】陈总从门口通道大步走入未落座，全景转中景跟拍，身形清晰；长桌两侧坐满虚焦参会者（上座董事长方向在画面深处），下座可空出，禁止清晰抢镜人脸', shot_type = '全景转中景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 9;

UPDATE storyboards SET image_prompt = '【会议桌座次】上座为董事长。【本镜主角】董事长坐上座抬眸望向门口，中近景对侧机位，面部清晰；两侧席虚焦参会者肩背，禁止空椅，禁止除董事长外清晰人脸', shot_type = '中近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 10;

COMMIT;
