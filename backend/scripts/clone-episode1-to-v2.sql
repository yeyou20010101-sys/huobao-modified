-- 克隆 drama 4 第1集 (episode_id=5) → 新集「第1集-V2」
BEGIN TRANSACTION;

INSERT INTO episodes (
  drama_id,
  episode_number,
  title,
  content,
  script_content,
  description,
  duration,
  status,
  video_url,
  thumbnail,
  image_config_id,
  video_config_id,
  audio_config_id,
  created_at,
  updated_at
)
SELECT
  drama_id,
  (SELECT COALESCE(MAX(episode_number), 0) + 1 FROM episodes WHERE drama_id = 4),
  '第1集-V2',
  content,
  script_content,
  description,
  duration,
  'draft',
  NULL,
  NULL,
  image_config_id,
  video_config_id,
  audio_config_id,
  datetime('now'),
  datetime('now')
FROM episodes
WHERE id = 5;

CREATE TEMP TABLE _new_episode (id INTEGER PRIMARY KEY);
INSERT INTO _new_episode (id) VALUES (last_insert_rowid());

INSERT INTO episode_scenes (episode_id, scene_id, created_at)
SELECT (SELECT id FROM _new_episode), scene_id, datetime('now')
FROM episode_scenes
WHERE episode_id = 5;

INSERT INTO episode_characters (episode_id, character_id, created_at)
SELECT (SELECT id FROM _new_episode), character_id, datetime('now')
FROM episode_characters
WHERE episode_id = 5;

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
  image_prompt,
  video_prompt,
  bgm_prompt,
  sound_effect,
  dialogue,
  description,
  duration,
  composed_image,
  first_frame_image,
  last_frame_image,
  reference_images,
  video_url,
  tts_audio_url,
  subtitle_url,
  composed_video_url,
  status,
  created_at,
  updated_at
)
SELECT
  (SELECT id FROM _new_episode),
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
  image_prompt,
  video_prompt,
  bgm_prompt,
  sound_effect,
  dialogue,
  description,
  duration,
  composed_image,
  first_frame_image,
  last_frame_image,
  reference_images,
  NULL,
  tts_audio_url,
  subtitle_url,
  NULL,
  'pending',
  datetime('now'),
  datetime('now')
FROM storyboards
WHERE episode_id = 5
  AND deleted_at IS NULL;

CREATE TEMP TABLE _sb_map AS
SELECT
  old_sb.id AS old_id,
  new_sb.id AS new_id
FROM storyboards old_sb
JOIN storyboards new_sb
  ON new_sb.episode_id = (SELECT id FROM _new_episode)
 AND new_sb.storyboard_number = old_sb.storyboard_number
WHERE old_sb.episode_id = 5
  AND old_sb.deleted_at IS NULL;

INSERT INTO storyboard_characters (storyboard_id, character_id)
SELECT map.new_id, sc.character_id
FROM storyboard_characters sc
JOIN _sb_map map ON map.old_id = sc.storyboard_id;

COMMIT;

SELECT
  e.id,
  e.episode_number,
  e.title,
  (SELECT COUNT(*) FROM storyboards sb WHERE sb.episode_id = e.id AND sb.deleted_at IS NULL) AS storyboard_count
FROM episodes e
WHERE e.drama_id = 4
  AND e.title = '第1集-V2'
ORDER BY e.id DESC
LIMIT 1;
