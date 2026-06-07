BEGIN TRANSACTION;

-- 删除旧开场 6 镜（id: 278,285,286,287,288,289）
DELETE FROM storyboard_characters WHERE storyboard_id IN (278, 285, 286, 287, 288, 289);
DELETE FROM storyboards WHERE id IN (278, 285, 286, 287, 288, 289);

-- 后续镜头顺延编号 7-11 → 9-13
UPDATE storyboards SET storyboard_number = 9,  updated_at = datetime('now') WHERE id = 279;
UPDATE storyboards SET storyboard_number = 10, updated_at = datetime('now') WHERE id = 280;
UPDATE storyboards SET storyboard_number = 11, updated_at = datetime('now') WHERE id = 281;
UPDATE storyboards SET storyboard_number = 12, updated_at = datetime('now') WHERE id = 282;
UPDATE storyboards SET storyboard_number = 13, updated_at = datetime('now') WHERE id = 283;

-- 新开场 8 镜
INSERT INTO storyboards (
  episode_id, scene_id, storyboard_number, title, description, shot_type, angle, movement,
  action, dialogue, result, atmosphere, image_prompt, video_prompt, bgm_prompt, sound_effect,
  location, time, duration, status, created_at, updated_at
) VALUES
(30, 25, 1, '会议室晨景', '现代科技公司会议室全景，深色胡桃木长桌居中，落地玻璃幕墙外城市天际线，侧窗微光，空镜或远端人物虚焦不可辨认。', '全景', '平视', '缓慢推镜',
 '冷色调清晨，长桌两侧座椅整齐，无人说话，只有空调低鸣与远处城市声，气氛肃穆压抑。', NULL, NULL, '冷色调，凝固感，决策前的静默。',
 '全景平视，现代会议室清晨，长会议桌与皮质座椅对称排列，落地玻璃幕墙，侧窗冷色微光，空调感静音氛围，纯环境或极远虚焦人影，无清晰人脸，电影级构图',
 '0-3秒：<location>会议室</location>全景，冷色调清晨，长桌与座椅静立，镜头缓慢推近，空调低鸣，无人对白。',
 '极低频弦乐铺底，几乎静止。', '空调低鸣、远处城市清晨环境声。', '会议室', '清晨', 3, 'pending', datetime('now'), datetime('now')),

(30, 25, 2, '董事长主位', '从长桌一侧望向桌首，董事长坐于主位椅子上，位于桌面后方，长桌占前景。', '中景', '平视', '缓慢推镜',
 '董事长端坐长桌尽头主位，双手交叉置于桌沿，眉头微锁，神情沉稳严肃，静默坐镇。', NULL, '确立会议主位权威感，为后续众人状态铺垫。', '清晨微光，肃穆安静，权威感。',
 '中景平视，从长桌侧方望向桌首主位。董事长坐在长桌尽头皮质办公椅上，位于桌面后方，双手交叉轻放桌沿，眉头微锁。长桌占画面前景，侧窗微光，仅董事长一人清晰可见',
 '0-3秒：<location>会议室</location>中景，<role>董事长</role>端坐主位，双手交叉置于桌面，神情沉稳，镜头缓慢推近。',
 '极低频弦乐铺底，几乎静止。', '空调低鸣、无对白。', '会议室', '清晨', 3, 'pending', datetime('now'), datetime('now')),

(30, 25, 3, '于总待命', '于总侧位中景，电脑屏幕与桌面资料可见，神情专注。', '中景', '平视', '固定',
 '于总坐于长桌右侧席位，目光紧盯笔记本电脑屏幕，正襟危坐，待命准备。', NULL, NULL, '专业、蓄势，战略研讨前的专注。',
 '中景平视，于总坐长桌右侧席位，笔记本电脑已开，桌面有架构图与方案文件，目光专注屏幕，仅于总一人清晰入镜，侧窗冷光与会议室环境一致',
 '0-3秒：<location>会议室</location>中景，<role>于总</role>坐右侧席位，紧盯电脑屏幕，正襟危坐，镜头固定。',
 '极低频弦乐持续，节奏平稳。', '电脑风扇低鸣、纸张轻微翻动。', '会议室', '清晨', 3, 'pending', datetime('now'), datetime('now')),

(30, 25, 4, '黄宇哲研判', '黄宇哲近景，专注报表，背景会议室虚焦。', '近景', '平视', '固定',
 '黄宇哲低头翻阅市场数据报表，眉头微蹙，神情凝重。', NULL, NULL, '凝重、深度思考的静默。',
 '近景平视，黄宇哲坐席位上低头翻阅报表，眉头微蹙，背景为虚焦会议室与桌沿，仅黄宇哲清晰，侧光打在脸上',
 '0-3秒：<location>会议室</location>近景，<role>黄宇哲</role>低头翻阅市场数据报表，眉头微蹙，镜头固定。',
 '低频弦乐，极缓。', '纸张翻动声、轻微呼吸。', '会议室', '清晨', 3, 'pending', datetime('now'), datetime('now')),

(30, 25, 5, '成立军沉思', '成立军近景，抱资料低头，务实稳重。', '近景', '平视', '固定',
 '成立军怀中抱着厚厚项目资料，低头沉思，梳理问题。', NULL, NULL, '务实、内敛的沉思感。',
 '近景平视，成立军坐席位上怀中抱厚资料低头沉思，眉头微蹙，背景虚焦，仅成立军一人清晰，与会议室冷色调光影一致',
 '0-3秒：<location>会议室</location>近景，<role>成立军</role>抱资料低头沉思，镜头固定。',
 '低频弦乐，极缓。', '资料页轻微摩擦声。', '会议室', '清晨', 3, 'pending', datetime('now'), datetime('now')),

(30, 25, 6, '曹总观察', '曹总近景，转笔观察，背景高管虚焦。', '近景', '平视', '固定',
 '曹总背靠座椅，指尖转动签字笔，目光扫视，神色淡然观察。', NULL, NULL, '淡然、审视，静压力。',
 '近景平视，曹总背靠座椅，指尖转签字笔，目光侧向观察，神色淡然，背景为虚焦会议室与他人轮廓，仅曹总清晰',
 '0-2秒：<location>会议室</location>近景，<role>曹总</role>背靠座椅转笔，淡然观察，镜头固定。',
 '极低频环境音，几乎无声。', '签字笔转动轻响、空调嗡鸣。', '会议室', '清晨', 2, 'pending', datetime('now'), datetime('now')),

(30, 25, 7, '陈总推门', '从门口全景跟拍陈总入画，穿深色职业套装，步伐利落。', '全景转中景', '平视', '跟镜',
 '会议室门被急促推开，陈总大步走入，目光坚定，径直向场内。', NULL, '叙事转折点，打破压抑静默，主角正式入场。', '节奏骤然加快，破局感，紧张被打破。',
 '全景转中景，会议室玻璃门被推开，陈总（中年女性、深色职业套装、干练）从门口大步走入，位于门与长桌之间的通道上，尚未落座，侧窗冷光打轮廓，仅陈总一人清晰',
 '0-3秒：门被急促推开，<location>会议室</location>全景，<role>陈总</role>大步步入，目光坚定。<n>3-5秒：跟镜至中景，陈总向长桌方向走去，脚步声清晰。',
 '弦乐轻微上扬，短促节奏强调转折。', '门轴声、急促脚步声、衣物摩擦声。', '会议室', '清晨', 5, 'pending', datetime('now'), datetime('now')),

(30, 25, 8, '抬眸示意', '董事长主位中景，视线转向门口方向。', '中景', '平视', '固定',
 '董事长抬眸看向门口，语气沉稳，手势示意陈总入座。', '董事长：这不正商量着吗，你来得正好，一起讨论讨论。', NULL, '弦乐略抬，对白留空间，接纳主角入场。',
 '中景平视，董事长坐主位抬眸望向门口方向，一手微抬示意入座，神情沉稳，仅董事长清晰，背景虚焦',
 '0-3秒：<location>会议室</location>中景，<role>董事长</role>抬眸看向门口，沉稳抬手示意入座。',
 '弦乐持续，略抬。', '环境音略收，留对白空间。', '会议室', '清晨', 3, 'pending', datetime('now'), datetime('now'));

-- 绑定角色（按插入顺序 id 自增，先查新 id）
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 10 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 2;
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 12 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 3;
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 13 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 4;
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 14 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 5;
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 15 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 6;
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 9 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 7;
-- 镜 8 仅绑董事长
INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT id, 10 FROM storyboards WHERE episode_id = 30 AND storyboard_number = 8;

COMMIT;
