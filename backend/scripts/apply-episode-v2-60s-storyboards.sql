-- 第1集-V2 (episode_id=33) 60秒分镜方案入库，prompt 全中文
BEGIN TRANSACTION;

UPDATE episodes SET
  script_content = '## S01 | 内景 · 数据空间 | 虚拟黎明

【镜0–1】无对白
浩瀚数字虚界里，稀疏冰蓝光点如远星。水平数据光带静静掠过，光点沉入粒子海洋，
涟漪在中心一层层展开，海面归于平静。（片头横排「四象」由后期叠字）

【镜2–4】
涟漪中心，柔和蓝光汇聚，圆润的小象逐渐成型，睁开澄澈如湖水的眼眸，
朝前方短发小女孩稳步走去。

小象抬起象鼻，轻轻贴上女孩掌心。接触处，暖金色微光悄然涌动。

小女孩：（微怔，低声）你……是谁？
小象：（轻晃象鼻，温和）跟我来。

## S02 | 外景 · 数字丛林 | 虚拟黄昏

【镜6–10】
粒子化作树影，虚幻数据树木林立，幽蓝代码在枝叶间流淌。
小女孩与小象并肩奔跑几步，风扬起她的短发与周围光点。

两人停下。小象仰头，神态空灵而古老。

小象：（悠远）太极生两仪，两仪生四象。四象生八卦，八卦生万物。

小女孩：（瞳孔微缩）万物……由你而生？

小象：（转头回望，俏皮）答案，就在你眼前。

—— 切黑 / 淡出 ——',
  duration = 60,
  updated_at = datetime('now')
WHERE id = 33;

-- 镜0 静海横展
UPDATE storyboards SET
  title = '静海横展',
  location = '数字混沌虚界 → 数字粒子海洋',
  time = '虚拟黎明',
  shot_type = '大全景',
  angle = '俯视转平视',
  movement = '慢推→略加速→再减速',
  description = '宏大开篇：数字虚界水平光带收束至平静粒子海。无人物、无文字、禁止光爆与白闪。',
  image_prompt = '二次元赛博科幻极远景，深海军蓝数字虚界，稀疏冰蓝粒子如远星，水平数据光带横穿画面，顶方柔和神光，空灵宏大，无人物无文字，8K

【首帧】极远景，粒子稀疏，中心无涟漪，整体中低亮度。
【尾帧】中心柔光、同心涟漪、密集粒子海，对齐「数字粒子海洋」场景图。
【禁止】爆炸、白闪、过曝、文字、UI、人物',
  video_prompt = '0-2秒：<location>数字混沌虚界</location>，大全景俯视，稀疏冰蓝光点与水平数据光带，极慢推轨。
2-4秒：光点沿水平方向流动下沉，亮度仅轻微提升，禁止螺旋汇聚与闪光。
4-6秒：<location>数字粒子海洋</location>，中心柔光与涟漪展开，粒子密度升高，减速停稳，曝光适中。',
  duration = 6,
  scene_id = 9,
  last_frame_image = 'static/images/f12ce1d4-aaa0-485e-9f92-1a46c43a7810.jpeg',
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 0;

-- 镜1 片头·四象
UPDATE storyboards SET
  title = '片头·四象',
  location = '数字粒子海洋',
  time = '虚拟黎明',
  shot_type = '全景',
  angle = '俯视',
  movement = '极慢推镜',
  description = '粒子海静景 hold，供后期横排「四象」叠字。AI 画面禁止出现任何文字。',
  image_prompt = '平静浩瀚的数字粒子海洋，冰蓝散景光点，中心柔和青色涟漪，中等曝光，空灵静谧，二次元动画电影感，空镜无人物无文字，8K

【首帧】与镜0尾帧构图接近，便于硬切或短溶解。
【尾帧】同构图，涟漪微动即可。
【禁止】任何文字、logo、人物、强光、爆发',
  video_prompt = '0-6秒：<location>数字粒子海洋</location>，全景俯视，粒子缓缓浮动、涟漪轻扩，极慢推轨，全程平静定场镜头，亮度稳定，禁止爆发或闪白。（后期：约2–4秒叠横排「四象」公司名，AI不出字）',
  duration = 6,
  scene_id = 9,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 1;

-- 镜2 小象诞生
UPDATE storyboards SET
  title = '小象诞生',
  location = '数字粒子海洋',
  time = '虚拟黎明',
  shot_type = '中景',
  angle = '平视',
  movement = '固定',
  description = '涟漪中心柔光凝聚，圆润小象由粒子成型。首帧尚无小象实体。',
  image_prompt = '二次元动画中景，数字粒子海洋涟漪中心，柔和蓝光汇聚，首帧空镜仅有涟漪，随后可爱圆润数字小象逐渐凝聚，浅白光晕，半透明数据质感，无人类，8K

【首帧】仅有涟漪与蓝光，无小象。
【尾帧】小象完整成型，双眼刚睁开。',
  video_prompt = '0-5秒：<location>数字粒子海洋</location>，中景平视，蓝光自涟漪中心汇聚，圆润小象由粒子凝聚成型，浅白光晕包裹，固定机位。',
  duration = 5,
  scene_id = 9,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 2;

-- 镜3 睁眼前行
UPDATE storyboards SET
  title = '睁眼前行',
  location = '数字粒子海洋',
  time = '虚拟黎明',
  shot_type = '近景',
  angle = '平视',
  movement = '跟拍',
  description = '小象睁开澄澈眼眸，向画面前方稳步行走。首帧不出现小女孩。',
  image_prompt = '二次元动画近景，可爱发光数字小象，湖水般清澈双眼睁开，在冰蓝粒子海洋中向前行走，温柔神态，画面中无小女孩，8K

【首帧】小象已成型刚睁眼。
【尾帧】小象向画面前方行走，仍无女孩入镜。',
  video_prompt = '0-5秒：<location>数字粒子海洋</location>，近景平视跟拍，小象睁眸，稳健向前，背景粒子轻动。',
  duration = 5,
  scene_id = 9,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 3;

-- 镜4 掌心相逢
UPDATE storyboards SET
  title = '掌心相逢',
  location = '数字粒子海洋',
  time = '虚拟黎明',
  shot_type = '特写',
  angle = '平视',
  movement = '固定',
  description = '小象象鼻轻贴小女孩掌心，暖金色微光交融。两人视觉等高。',
  image_prompt = '二次元动画特写，可爱发光小象象鼻轻触短发小女孩手掌，两人身高视觉接近，接触点暖金色光芒，冰蓝粒子背景，神奇连接感，8K

【首帧】小象接近，女孩手部入画。
【尾帧】象鼻与掌心贴合，金光亮起。',
  video_prompt = '0-3秒：<location>数字粒子海洋</location>，特写平视，小象象鼻抬起靠近<role>小女孩</role>。
3-6秒：象鼻贴合掌心，暖金色微光涌动交融，固定机位。',
  dialogue = '小女孩：（微怔，低声）你……是谁？
小象：（轻晃象鼻，温和）跟我来。',
  duration = 6,
  scene_id = 9,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 4;

-- 镜6 丛林一瞬
UPDATE storyboards SET
  title = '丛林一瞬',
  location = '虚幻数字丛林',
  time = '虚拟黄昏',
  shot_type = '全景',
  angle = '侧拍',
  movement = '跟拍',
  description = '粒子海溶接数字丛林，小女孩与小象并肩奔跑数步，小象在右侧、略高。',
  image_prompt = '二次元动画广角全景，短发小女孩与发光小象并肩奔跑，小象在右侧略高，虚幻数字丛林，半透明数据树散发幽蓝代码光，粒子漂浮，动态轻盈，8K

【首帧】可带触掌金光粒子转场感。
【尾帧】奔跑中，树影与代码光清晰。',
  video_prompt = '0-2秒：粒子海洋溶接为<location>虚幻数字丛林</location>，全景。
2-8秒：侧拍跟拍，<role>小女孩</role>与<role>小象</role>并肩跑三四步，短发与粒子飘动，小象在右略高，勿过长。',
  duration = 8,
  scene_id = 10,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 6;

-- 镜7 驻足仰望
UPDATE storyboards SET
  title = '驻足仰望',
  location = '虚幻数字丛林',
  time = '虚拟黄昏',
  shot_type = '中景',
  angle = '仰视',
  movement = '固定',
  description = '奔跑渐停，小象仰头空灵，小女孩侧立好奇观望。两人视觉等高。',
  image_prompt = '二次元动画中景仰视，可爱发光小象仰头，空灵智慧神态，短发小女孩身侧站立、好奇观望，身高视觉接近，数字丛林幽蓝代码光，8K',
  video_prompt = '0-5秒：<location>虚幻数字丛林</location>，中景仰视，奔跑渐停，<role>小象</role>仰头，<role>小女孩</role>侧立观望，固定机位。',
  duration = 5,
  scene_id = 10,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 7;

-- 镜8 太极哲言
UPDATE storyboards SET
  title = '太极哲言',
  location = '虚幻数字丛林',
  time = '虚拟黄昏',
  shot_type = '近景',
  angle = '平视',
  movement = '缓慢推镜',
  description = '小象仰头发声，空灵念出太极四象哲言。平静不夸张。',
  image_prompt = '二次元动画近景，可爱发光小象面部，空灵智慧眼神，正在发声，虚幻数字丛林背景，代码光带流动，平静电影布光，8K',
  video_prompt = '0-7秒：<location>虚幻数字丛林</location>，近景缓推，<role>小象</role>仰头发声，<voice>小象</voice>太极生两仪，两仪生四象。四象生八卦，八卦生万物。',
  dialogue = '小象：（仰头，声音空灵悠远）太极生两仪，两仪生四象。四象生八卦，八卦生万物。',
  duration = 7,
  scene_id = 10,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 8;

-- 镜9 错愕一瞬
UPDATE storyboards SET
  title = '错愕一瞬',
  location = '虚幻数字丛林',
  time = '虚拟黄昏',
  shot_type = '中景',
  angle = '平视',
  movement = '固定',
  description = '小女孩听到哲言后错愕震撼，瞳孔微缩。',
  image_prompt = '二次元动画中景，短发小女孩错愕震撼，瞳孔微缩，虚幻数字丛林背景，柔和蓝光，8K',
  video_prompt = '0-5秒：<location>虚幻数字丛林</location>，中景平视，<role>小女孩</role>错愕震撼，<voice>小女孩</voice>万物……由你而生？',
  dialogue = '小女孩：（瞳孔微缩，满脸错愕）万物……由你而生？',
  duration = 5,
  scene_id = 10,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 9;

-- 镜10 俏皮收束
UPDATE storyboards SET
  title = '俏皮收束',
  location = '虚幻数字丛林',
  time = '虚拟黄昏',
  shot_type = '特写',
  angle = '平视',
  movement = '固定',
  description = '小象转头俏皮回望，全集收束，留白便于淡出。',
  image_prompt = '二次元动画特写，可爱发光小象转头回望，眼眸明亮俏皮，柔和白光，数字丛林散景，静谧结尾氛围，8K

【尾帧】可略暗便于淡出黑场。',
  video_prompt = '0-4秒：<location>虚幻数字丛林</location>，特写平视，<role>小象</role>转头回望，眼神俏皮。
4-7秒：<voice>小象</voice>答案，就在你眼前。画面保持，粒子微动，适合淡出结束。',
  dialogue = '小象：（转头回望，眼眸明亮，神态俏皮）答案，就在你眼前。',
  duration = 7,
  scene_id = 10,
  updated_at = datetime('now')
WHERE episode_id = 33 AND storyboard_number = 10;

COMMIT;

SELECT storyboard_number, title, duration FROM storyboards WHERE episode_id=33 ORDER BY storyboard_number;
SELECT SUM(duration) FROM storyboards WHERE episode_id=33;
