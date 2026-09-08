-- 第1集开篇：镜 0「星落归海」5秒，不改原镜 1-12，后期剪辑衔接
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
  last_frame_image,
  status,
  created_at,
  updated_at
) VALUES (
  5,
  9,
  0,
  '星落归海',
  '数字混沌虚界 → 数字粒子海洋',
  '虚拟黎明',
  '大全景',
  '俯视转平视',
  '慢推加速再减速',
  '稀疏冰蓝数据光点自远空向画面中心汇聚，形成数据潮汐后沉入粒子海洋，中心光核亮起、同心涟漪展开',
  '尾帧构图与场景「数字粒子海洋」一致，便于剪辑衔接原镜1',
  '宏大、空灵、科幻玄虚；深海军蓝底色，冰蓝与青白高光，顶方神光俯照',
  '5秒宏大开篇：自更大尺度数字虚界一镜收束至粒子海洋。无人物、无对白。后期剪辑接原镜1「粒子海洋铺展」。',
  'Extreme wide digital void, sparse ice-blue data particles like distant star clusters in deep navy space, faint luminous data streams, single volumetric god ray from top center, ethereal cosmic scale, anime cinematic sci-fi, no characters, 8k

【首帧】极远景：粒子稀疏、中心尚未形成涟漪，只有远处微光与顶光。
【尾帧】对齐场景参考：中心明亮光核、同心涟漪、密集冰蓝粒子海——与数字粒子海洋场景图一致。
【禁止】人物、文字、UI、水印、满屏噪点',
  '0-1.5秒：<location>数字混沌虚界</location>，大全景俯视，深空般数字虚界中稀疏冰蓝光点如远星，顶方一束冷白神光，极慢推轨向前。
1.5-3.5秒：光点加速向画面中心汇聚，形成螺旋数据潮汐，亮度渐增，推轨略加快。
3.5-5秒：<location>数字粒子海洋</location>，中心光核亮起，同心涟漪层层展开，粒子密度升高，构图与尾帧参考一致，减速停稳。',
  5,
  'static/images/f12ce1d4-aaa0-485e-9f92-1a46c43a7810.jpeg',
  'pending',
  datetime('now'),
  datetime('now')
);
