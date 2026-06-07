-- 优化镜 1-8 image_prompt：虚焦参会者填满座位，避免空椅违和
UPDATE storyboards SET image_prompt = '全景平视，现代会议室清晨，长会议桌两侧坐满参会者，全部为远景浅景深虚焦，仅见深色西装肩背轮廓与头顶剪影，无一张清晰可辨的人脸；主位方向亦为人形虚影。侧窗冷色微光，肃穆安静，禁止出现无人落座的空皮椅，电影级构图', shot_type = '全景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 1;

UPDATE storyboards SET image_prompt = '中近景平视，略低机位望向桌首主位。董事长坐主位椅上双手交叉轻放桌沿，面部与上半身清晰锐利；画面左右边缘仅露出1-2名参会者的虚焦肩背剪影，面部完全不可辨。构图裁切减少两侧空椅入画，浅景深，禁止无人空座，禁止除董事长外任何清晰人脸', shot_type = '中近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 2;

UPDATE storyboards SET image_prompt = '中近景平视，于总坐右侧席位看笔记本电脑，面部与手部清晰；同排相邻席位可见虚焦参会者肩背轮廓与笔记本边缘，面部不可辨。前景桌沿与文件轻微虚化，浅景深，背景不得出现空无人皮椅，禁止清晰出现第二个人脸', shot_type = '中近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 3;

UPDATE storyboards SET image_prompt = '近景平视，黄宇哲低头翻阅报表，眉头微蹙，面部与手部清晰；背景仅占画面边缘，为虚焦相邻参会者深色西装肩线、报表角与窗光光斑，连续人形轮廓暗示满座，无空椅，无清晰第二人脸', shot_type = '近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 4;

UPDATE storyboards SET image_prompt = '近景平视，成立军抱厚资料低头沉思，面部清晰；背景为虚焦参会者肩背剪影与资料堆轮廓，浅景深，座位区连续有人形虚影，禁止空无人座椅，禁止清晰第二人脸', shot_type = '近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 5;

UPDATE storyboards SET image_prompt = '近景平视，曹总背靠座椅转签字笔，面部清晰；背景两侧为虚焦参会者肩背与侧脸轮廓（极度虚化不可辨认），浅景深，长桌两侧席位均有人形虚影，禁止空椅，禁止清晰第二人脸', shot_type = '近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 6;

UPDATE storyboards SET image_prompt = '全景转中景，玻璃门推开陈总大步走入，身形清晰；背景长桌两侧坐满参会者均为景深虚焦剪影，肩背轮廓连续排列无断档，无空座，无清晰人脸与主角抢镜，侧窗冷光', shot_type = '全景转中景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 7;

UPDATE storyboards SET image_prompt = '中近景平视，董事长坐主位抬眸望向门口，一手微抬示意，面部清晰；两侧席位边缘可见虚焦参会者肩背轮廓，浅景深，禁止空无人座椅，禁止除董事长外清晰人脸', shot_type = '中近景', updated_at = datetime('now') WHERE episode_id = 30 AND storyboard_number = 8;
