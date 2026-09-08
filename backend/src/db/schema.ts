/**
 * Drizzle schema — 精确匹配现有 SQLite 数据库列名
 * 从 PRAGMA table_info() 逆向生成
 */
import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  status: text('status').notNull().default('active'),
  emailVerifiedAt: text('email_verified_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const emailTokens = sqliteTable('email_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  type: text('type').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull(),
})

export const dramaMembers = sqliteTable('drama_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dramaId: integer('drama_id').notNull(),
  userId: integer('user_id').notNull(),
  role: text('role').notNull(),
  invitedBy: integer('invited_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
})

export const dramas = sqliteTable('dramas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  title: text('title').notNull(),
  description: text('description'),
  genre: text('genre'),
  style: text('style').default('realistic'),
  totalEpisodes: integer('total_episodes').default(1),
  totalDuration: integer('total_duration').default(0),
  status: text('status').notNull().default('draft'),
  thumbnail: text('thumbnail'),
  tags: text('tags'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dramaId: integer('drama_id').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  scriptContent: text('script_content'),
  description: text('description'),
  duration: integer('duration').default(0),
  status: text('status').default('draft'),
  videoUrl: text('video_url'),
  thumbnail: text('thumbnail'),
  imageConfigId: integer('image_config_id'),
  videoConfigId: integer('video_config_id'),
  audioConfigId: integer('audio_config_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const characters = sqliteTable('characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dramaId: integer('drama_id').notNull(),
  name: text('name').notNull(),
  role: text('role'),
  description: text('description'),
  appearance: text('appearance'),
  personality: text('personality'),
  voiceStyle: text('voice_style'),
  imageUrl: text('image_url'),
  referenceImages: text('reference_images'),
  seedValue: text('seed_value'),
  sortOrder: integer('sort_order'),
  localPath: text('local_path'),
  voiceSampleUrl: text('voice_sample_url'),
  voiceProvider: text('voice_provider'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

// Episode-Character many-to-many
export const episodeCharacters = sqliteTable('episode_characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull(),
  characterId: integer('character_id').notNull(),
  createdAt: text('created_at').notNull(),
})

// Episode-Scene many-to-many
export const episodeScenes = sqliteTable('episode_scenes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull(),
  sceneId: integer('scene_id').notNull(),
  createdAt: text('created_at').notNull(),
})

export const scenes = sqliteTable('scenes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dramaId: integer('drama_id').notNull(),
  episodeId: integer('episode_id'),
  location: text('location').notNull(),
  time: text('time').notNull(),
  prompt: text('prompt').notNull(),
  storyboardCount: integer('storyboard_count').default(1),
  imageUrl: text('image_url'),
  status: text('status').default('pending'),
  localPath: text('local_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const storyboards = sqliteTable('storyboards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episodeId: integer('episode_id').notNull(),
  sceneId: integer('scene_id'),
  storyboardNumber: integer('storyboard_number').notNull(),
  title: text('title'),
  location: text('location'),
  time: text('time'),
  shotType: text('shot_type'),
  angle: text('angle'),
  movement: text('movement'),
  action: text('action'),
  result: text('result'),
  atmosphere: text('atmosphere'),
  imagePrompt: text('image_prompt'),
  videoPrompt: text('video_prompt'),
  bgmPrompt: text('bgm_prompt'),
  soundEffect: text('sound_effect'),
  dialogue: text('dialogue'),
  description: text('description'),
  duration: integer('duration').default(0),
  composedImage: text('composed_image'),
  firstFrameImage: text('first_frame_image'),
  lastFrameImage: text('last_frame_image'),
  referenceImages: text('reference_images'),
  videoUrl: text('video_url'),
  ttsAudioUrl: text('tts_audio_url'),
  subtitleUrl: text('subtitle_url'),
  composedVideoUrl: text('composed_video_url'),
  status: text('status').default('pending'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const storyboardCharacters = sqliteTable('storyboard_characters', {
  storyboardId: integer('storyboard_id').notNull(),
  characterId: integer('character_id').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.storyboardId, table.characterId] }),
}))

export const aiServiceConfigs = sqliteTable('ai_service_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  serviceType: text('service_type').notNull(),
  provider: text('provider'),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key').notNull(),
  model: text('model'),
  endpoint: text('endpoint'),
  queryEndpoint: text('query_endpoint'),
  priority: integer('priority').default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  settings: text('settings'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  // 注意: 此表无 deleted_at
})

export const aiServiceProviders = sqliteTable('ai_service_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  displayName: text('display_name'),
  serviceType: text('service_type').notNull(),
  provider: text('provider').notNull(),
  defaultUrl: text('default_url'),
  presetModels: text('preset_models'),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const aiVoices = sqliteTable('ai_voices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  voiceId: text('voice_id').notNull().unique(),   // MiniMax voice_id
  voiceName: text('voice_name').notNull(),         // 中文名
  description: text('description'),                // 描述数组 JSON
  language: text('language'),                     // 语言标签
  provider: text('provider').notNull(),           // minimax
  createdAt: text('created_at').notNull(),
})

export const agentConfigs = sqliteTable('agent_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  agentType: text('agent_type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  model: text('model'),
  systemPrompt: text('system_prompt'),
  temperature: real('temperature'),
  maxTokens: integer('max_tokens'),
  maxIterations: integer('max_iterations'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const imageGenerations = sqliteTable('image_generations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  storyboardId: integer('storyboard_id'),
  dramaId: integer('drama_id'),
  sceneId: integer('scene_id'),
  characterId: integer('character_id'),
  propId: integer('prop_id'),
  imageType: text('image_type'),
  frameType: text('frame_type'),
  provider: text('provider'),
  prompt: text('prompt'),
  negativePrompt: text('negative_prompt'),
  model: text('model'),
  size: text('size'),
  quality: text('quality'),
  style: text('style'),
  steps: integer('steps'),
  cfgScale: real('cfg_scale'),
  seed: integer('seed'),
  imageUrl: text('image_url'),
  minioUrl: text('minio_url'),
  localPath: text('local_path'),
  status: text('status').default('pending'),
  taskId: text('task_id'),
  errorMsg: text('error_msg'),
  width: integer('width'),
  height: integer('height'),
  referenceImages: text('reference_images'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
})

export const videoGenerations = sqliteTable('video_generations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  storyboardId: integer('storyboard_id'),
  dramaId: integer('drama_id'),
  provider: text('provider'),
  prompt: text('prompt'),
  model: text('model'),
  imageGenId: integer('image_gen_id'),
  referenceMode: text('reference_mode'),
  imageUrl: text('image_url'),
  firstFrameUrl: text('first_frame_url'),
  lastFrameUrl: text('last_frame_url'),
  referenceImageUrls: text('reference_image_urls'),
  referenceVideoUrls: text('reference_video_urls'),
  duration: integer('duration'),
  fps: integer('fps'),
  resolution: text('resolution'),
  aspectRatio: text('aspect_ratio'),
  style: text('style'),
  motionLevel: integer('motion_level'),
  cameraMotion: text('camera_motion'),
  seed: integer('seed'),
  videoUrl: text('video_url'),
  minioUrl: text('minio_url'),
  localPath: text('local_path'),
  status: text('status').default('pending'),
  taskId: text('task_id'),
  errorMsg: text('error_msg'),
  width: integer('width'),
  height: integer('height'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
  deletedAt: text('deleted_at'),
})

/** 独立创作台任务（不绑定剧集分镜） */
export const createJobs = sqliteTable('create_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  kind: text('kind').notNull(), // image | video（输出类型）
  generationId: integer('generation_id'),
  prompt: text('prompt'),
  mediaPath: text('media_path'), // 兼容：首个附件路径
  assetsJson: text('assets_json'), // 多附件 JSON
  status: text('status').default('pending'),
  resultPath: text('result_path'),
  errorMsg: text('error_msg'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
})

export const videoMerges = sqliteTable('video_merges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  episodeId: integer('episode_id'),
  dramaId: integer('drama_id'),
  title: text('title'),
  provider: text('provider'),
  model: text('model'),
  status: text('status').default('pending'),
  scenes: text('scenes'), // JSON
  mergedUrl: text('merged_url'),
  duration: integer('duration'),
  taskId: text('task_id'),
  errorMsg: text('error_msg'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
  deletedAt: text('deleted_at'),
})

export const props = sqliteTable('props', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dramaId: integer('drama_id').notNull(),
  name: text('name').notNull(),
  type: text('type'),
  description: text('description'),
  prompt: text('prompt'),
  imageUrl: text('image_url'),
  referenceImages: text('reference_images'),
  localPath: text('local_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const assets = sqliteTable('assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dramaId: integer('drama_id'),
  episodeId: integer('episode_id'),
  storyboardId: integer('storyboard_id'),
  storyboardNum: integer('storyboard_num'),
  name: text('name'),
  description: text('description'),
  type: text('type'),
  category: text('category'),
  url: text('url'),
  thumbnailUrl: text('thumbnail_url'),
  localPath: text('local_path'),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'),
  format: text('format'),
  imageGenId: integer('image_gen_id'),
  videoGenId: integer('video_gen_id'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
  viewCount: integer('view_count').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const walletAccounts = sqliteTable('wallet_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique(),
  availablePoints: integer('available_points').notNull().default(0),
  frozenPoints: integer('frozen_points').notNull().default(0),
  totalConsumed: integer('total_consumed').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const billingPrices = sqliteTable('billing_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskType: text('task_type').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  unitPoints: integer('unit_points').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  uniqTaskProviderModel: uniqueIndex('idx_billing_prices_task_provider_model').on(
    table.taskType,
    table.provider,
    table.model,
  ),
}))

export const usageRecords = sqliteTable('usage_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  dramaId: integer('drama_id'),
  episodeId: integer('episode_id'),
  storyboardId: integer('storyboard_id'),
  taskType: text('task_type').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  unitPoints: integer('unit_points').notNull(),
  quantity: integer('quantity').notNull().default(1),
  points: integer('points').notNull(),
  status: text('status').notNull(),
  refType: text('ref_type'),
  refId: integer('ref_id'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  errorMsg: text('error_msg'),
  settledAt: text('settled_at'),
  refundedAt: text('refunded_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  userCreatedIdx: index('idx_usage_records_user_created').on(table.userId, table.createdAt),
  refIdx: index('idx_usage_records_ref').on(table.refType, table.refId),
  statusIdx: index('idx_usage_records_status').on(table.status),
}))

export const walletTransactions = sqliteTable('wallet_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  usageRecordId: integer('usage_record_id'),
  rechargeOrderId: integer('recharge_order_id'),
  type: text('type').notNull(),
  points: integer('points').notNull(),
  availableAfter: integer('available_after').notNull(),
  frozenAfter: integer('frozen_after').notNull(),
  remark: text('remark'),
  operatorId: integer('operator_id'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  userCreatedIdx: index('idx_wallet_transactions_user_created').on(table.userId, table.createdAt),
}))

export const rechargePackages = sqliteTable('recharge_packages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull(),
  basePoints: integer('base_points').notNull(),
  bonusPoints: integer('bonus_points').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  activeSortIdx: index('idx_recharge_packages_active_sort').on(table.isActive, table.sortOrder),
}))

export const rechargeOrders = sqliteTable('recharge_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNo: text('order_no').notNull().unique(),
  userId: integer('user_id').notNull(),
  packageId: integer('package_id'),
  packageName: text('package_name').notNull(),
  amountCents: integer('amount_cents').notNull(),
  basePoints: integer('base_points').notNull(),
  bonusPoints: integer('bonus_points').notNull().default(0),
  totalPoints: integer('total_points').notNull(),
  status: text('status').notNull().default('pending'),
  qrCode: text('qr_code'),
  alipayTradeNo: text('alipay_trade_no').unique(),
  expiresAt: text('expires_at').notNull(),
  notifiedAt: text('notified_at'),
  paidAt: text('paid_at'),
  closedAt: text('closed_at'),
  errorMsg: text('error_msg'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  userCreatedIdx: index('idx_recharge_orders_user_created').on(table.userId, table.createdAt),
  statusExpiresIdx: index('idx_recharge_orders_status_expires').on(table.status, table.expiresAt),
}))
