-- 第五集镜 11-15：单人绑定重构（陈总→黄宇哲→于总→陈总→董事长）
-- episode_id=30

BEGIN TRANSACTION;

UPDATE storyboards SET
  title = '落笔四象',
  description = '陈总白板前落笔「四象」，转身揭晓品牌名。',
  shot_type = '中近景',
  angle = '平视略偏侧，浅景深局部裁切',
  movement = '固定',
  duration = 12,
  action = '陈总写下「四象」二字，转身先讲述梦境，再援引古语揭晓品牌名。',
  dialogue = '陈总：我昨晚梦见一只蓝色小象，带着我在算力世界里奔跑……太极生两仪，两仪生四象，四象生八卦。它说，它叫——四象。',
  atmosphere = '安静中笔尖摩擦声突出，光线逐渐聚焦白板。',
  location = '会议室白板前',
  image_prompt = '【无满座要求】中近景，平视略偏侧。陈总站在白板前，手持马克笔刚在白板上写下「四象」二字，笔锋凌厉，神情专注；画面主体为陈总上半身、手部与马克笔及白板局部（仅见「四象」字样）。构图严格裁切：不展示完整会议室、不展示长会议桌、不展示任何其他参会者；背景仅限白板两侧浅景深虚化的墙面与侧窗光斑，无需其他人物。禁止清晰第二人脸',
  video_prompt = '0-2秒：<location>会议室白板前</location>近景，<role>陈总</role>拿起马克笔，在白板上用力写下「四象」二字，笔尖摩擦清晰，无对白。<n>2-8秒：陈总转身面向众人，讲述梦见蓝色小象在算力世界奔跑的梦境，语气清亮，镜头固定。<n>8-12秒：陈总稍顿，援引「太极生两仪，两仪生四象」，目光坚定说出「它叫——四象」。',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 11;

UPDATE storyboards SET
  title = '四象动容',
  description = '黄宇哲听到「四象」后动容低喃。',
  shot_type = '近景特写',
  angle = '平视略偏左，浅景深局部裁切',
  movement = '固定',
  duration = 3,
  action = '黄宇哲听到品牌名后缓缓抬头，低声呢喃，神情动容思索。',
  dialogue = '黄宇哲：四象……',
  atmosphere = '肃穆转为震撼，光线微暖。',
  location = '会议室',
  image_prompt = '【无满座要求】近景特写，平视略偏左。黄宇哲坐席位上缓缓抬头，唇微动低声呢喃，神情动容思索；画面主体为面部与肩部，背景为浅景深虚化的墙面与侧窗光斑，无需其他参会者。禁止清晰第二人脸、禁止长桌远端入画',
  video_prompt = '0-3秒：<location>会议室</location>近景，<role>黄宇哲</role>缓缓抬头，低声呢喃「四象」，神情动容，镜头固定。',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 12;

UPDATE storyboards SET
  title = '格局赞叹',
  description = '于总眼底惊艳，低声赞叹品牌格局。',
  shot_type = '近景特写',
  angle = '平视略偏左，浅景深局部裁切',
  movement = '固定',
  duration = 3,
  action = '于总眼底闪过惊艳，微微点头，低声赞叹这个名字格局太大。',
  dialogue = '于总：这个名字，格局太大了。',
  atmosphere = '震撼中带着敬服，光线微暖。',
  location = '会议室',
  image_prompt = '【无满座要求】近景特写，平视略偏左。于总坐席位上眼底闪过惊艳，微微点头低声赞叹，神情郑重；画面主体为面部与上半身，背景为浅景深虚化的墙面与侧窗光斑，无需其他参会者。禁止清晰第二人脸',
  video_prompt = '0-3秒：<location>会议室</location>近景，<role>于总</role>眼底闪过惊艳，低声赞叹，微微点头，镜头固定。',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 13;

UPDATE storyboards SET
  title = '理念阐述',
  description = '陈总勾勒蓝色小象，阐述品牌初心与四象格局。',
  shot_type = '中近景',
  angle = '平视，浅景深局部裁切',
  movement = '缓慢跟镜',
  duration = 10,
  action = '陈总勾勒蓝色小象轮廓，边画边分段阐述品牌初心与四象格局。',
  dialogue = '陈总：我认为这就是我们的品牌答案。小象，是我们的初心。四象，是我们的格局。品牌核心叫——四象。',
  atmosphere = '光线转暖，充满希望与力量感。',
  location = '会议室白板前',
  image_prompt = '【无满座要求】中近景，平视。陈总站在白板前，手指着刚画好的蓝色小象简笔画轮廓，神情自信坚定；画面主体为陈总上半身、手势与白板上的蓝色小象轮廓局部。构图严格裁切：不展示完整会议室、不展示长桌、不展示其他参会者；背景仅限浅景深虚化的墙面与光斑，无需其他人物。禁止清晰第二人脸',
  video_prompt = '0-3秒：<location>会议室白板前</location>近景，<role>陈总</role>提笔快速勾勒出蓝色小象轮廓，线条流畅，无对白。<n>3-10秒：陈总边画边指向轮廓，分段阐述「小象是初心、四象是格局」，最后强调品牌核心叫四象，镜头缓慢跟随手势。',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 14;

UPDATE storyboards SET
  title = '定音展望',
  description = '董事长拍案定音，宣告四象是起点与未来，晨光洒入。',
  shot_type = '中近景特写',
  angle = '平视略仰，浅景深局部裁切',
  movement = '缓慢拉镜',
  duration = 5,
  action = '董事长缓缓起身，手掌重重拍在桌面定音，沉稳宣告四象是起点与未来；侧窗晨光渐亮洒入，照亮白板方向。',
  dialogue = '董事长：就定了！品牌名：四象！从今天起——四象，就是我们的起点。也是我们的未来。',
  atmosphere = '充满决断力与希望，晨光破晓，温暖明亮。',
  location = '会议室',
  image_prompt = '【无满座要求】中近景特写，平视略仰。董事长站立于长桌主位前，手掌拍在桌面上后抬眸沉稳宣告，侧窗晨光洒入照亮面部；画面主体为董事长上半身与拍案手部，仅保留面前约40cm桌沿。构图严格裁切：不展示长桌远端、不展示其他参会者；背景为浅景深窗光与白板方向光斑，无需其他人物。禁止清晰第二人脸',
  video_prompt = '0-2秒：<location>会议室</location>中近景，<role>董事长</role>缓缓起身，手掌重重拍在桌面上，掷地有声。<n>2-5秒：董事长语气沉稳宣告四象是起点与未来，侧窗晨光渐亮洒入，镜头缓慢拉远。',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 15;

DELETE FROM storyboard_characters
WHERE storyboard_id IN (
  SELECT id FROM storyboards WHERE episode_id = 30 AND storyboard_number BETWEEN 11 AND 15
);

INSERT INTO storyboard_characters (storyboard_id, character_id) VALUES
  ((SELECT id FROM storyboards WHERE episode_id = 30 AND storyboard_number = 11), 9),
  ((SELECT id FROM storyboards WHERE episode_id = 30 AND storyboard_number = 12), 13),
  ((SELECT id FROM storyboards WHERE episode_id = 30 AND storyboard_number = 13), 12),
  ((SELECT id FROM storyboards WHERE episode_id = 30 AND storyboard_number = 14), 9),
  ((SELECT id FROM storyboards WHERE episode_id = 30 AND storyboard_number = 15), 10);

COMMIT;
