-- 批量收紧单人近景构图（镜 3/4/5/6/7/8），避免露出无椅无人的长桌远端
-- episode_id=30 第五集开场会议室单人镜

UPDATE storyboards SET
  shot_type = '中近景特写',
  angle = '平视略偏左，从左前方45度，浅景深局部裁切',
  image_prompt = '【无满座要求】中近景特写，平视略偏左，从左前方45度。于总坐右侧上席，目光紧盯笔记本电脑屏幕，正襟危坐；画面主体为面部、手部与笔记本屏幕边缘，仅保留面前约40cm局部桌沿。构图严格裁切：不展示长桌远端、不展示桌面对角延伸、不展示对称全景；背景仅限肩后浅景深虚化的侧窗冷光、墙面与模糊光斑，无需其他参会者人影。禁止无椅子的空桌区域、禁止清晰第二人脸、禁止空无人皮椅入画',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 3;

UPDATE storyboards SET
  shot_type = '近景特写',
  angle = '平视略偏左，浅景深局部裁切',
  image_prompt = '【无满座要求】近景特写，平视略偏左。黄宇哲坐右侧中席，低头翻阅市场数据报表，眉头微蹙；画面主体为面部、手部与指节及纸面细节，仅保留面前约40cm局部桌沿与报表边缘。构图严格裁切：不展示长桌远端、不展示桌面对角延伸、不展示对称全景；背景仅限肩后浅景深虚化的侧窗冷光、墙面与模糊光斑，无需其他参会者人影。禁止无椅子的空桌区域、禁止清晰第二人脸、禁止空无人皮椅入画',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 4;

UPDATE storyboards SET
  shot_type = '近景特写',
  angle = '平视略偏左，浅景深局部裁切',
  image_prompt = '【无满座要求】近景特写，平视略偏左。成立军坐右侧下席，怀中抱着厚厚项目资料低头沉思；画面主体为面部、手部与资料边缘，仅保留面前约40cm局部桌沿。构图严格裁切：不展示长桌远端、不展示桌面对角延伸、不展示对称全景；背景仅限肩后浅景深虚化的侧窗冷光、墙面与模糊光斑，无需其他参会者人影。禁止无椅子的空桌区域、禁止清晰第二人脸、禁止空无人皮椅入画',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 5;

UPDATE storyboards SET
  shot_type = '近景特写',
  angle = '平视略偏右，浅景深局部裁切',
  image_prompt = '【无满座要求】近景特写，平视略偏右。曹总坐左侧下席，背靠座椅指尖转动签字笔，神色淡然；画面主体为面部、手部与签字笔细节，仅保留面前约40cm局部桌沿。构图严格裁切：不展示长桌远端、不展示桌面对角延伸、不展示对称全景；背景仅限肩后浅景深虚化的侧窗冷光、墙面与模糊光斑，无需其他参会者人影。禁止无椅子的空桌区域、禁止清晰第二人脸、禁止空无人皮椅入画',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 6;

UPDATE storyboards SET
  shot_type = '近景特写',
  angle = '平视，浅景深局部裁切',
  image_prompt = '【无满座要求】近景特写，平视。王英姿坐左侧中席，手持会议记录本认真整理，神情专注；画面主体为面部、手部与记录本边缘，仅保留面前约40cm局部桌沿。构图严格裁切：不展示长桌远端、不展示桌面对角延伸、不展示对称全景；背景仅限肩后浅景深虚化的侧窗冷光、墙面与模糊光斑，无需其他参会者人影。禁止无椅子的空桌区域、禁止清晰第二人脸、禁止空无人皮椅入画',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 7;

UPDATE storyboards SET
  shot_type = '近景特写',
  angle = '平视略偏右，浅景深局部裁切',
  image_prompt = '【无满座要求】近景特写，平视略偏右。王沈样站立白板旁专注调试投影设备，手指调整按键；画面主体为面部、手部与白板/投影设备局部，仅保留白板一角与设备按钮区。构图严格裁切：不展示完整会议室全景、不展示长桌远端与桌面对角延伸；背景仅限浅景深虚化的投影光斑、墙面与模糊光斑，无需其他参会者人影。禁止无椅子的空桌区域、禁止清晰第二人脸',
  updated_at = datetime('now')
WHERE episode_id = 30 AND storyboard_number = 8;
