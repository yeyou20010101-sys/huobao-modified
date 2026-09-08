<template>
  <div class="create-page">
    <div class="create-stage">
      <header class="create-hero">
        <p class="create-kicker">媒体创作台</p>
        <h1 class="create-title">上传参考，即刻改写</h1>
        <p class="create-sub">可上传多张图片、多段视频，并为每项标注角色后生成</p>
      </header>

      <section
        class="create-composer"
        :class="{ 'is-dragover': dragOver, 'has-attachment': attachments.length > 0 }"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <input
          ref="fileInputRef"
          type="file"
          class="asset-file-input"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
          @change="onFileChange"
        />

        <div
          class="composer-empty"
          :class="{ compact: attachments.length > 0 }"
          @click="!uploading && fileInputRef?.click()"
        >
          <div class="upload-mark" :class="{ busy: uploading }">
            <span v-if="uploading" class="attach-spinner" />
            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div class="upload-copy">
            <strong>{{ uploading ? '正在上传…' : (attachments.length ? '继续添加参考素材' : '拖拽文件到这里，或点击上传') }}</strong>
            <span>支持多图 / 多视频混传 · JPG PNG WebP GIF · MP4 WebM MOV（单视频 ≤20MB）</span>
          </div>
        </div>

        <div v-if="attachments.length" class="attach-list">
          <div v-for="item in attachments" :key="item.id" class="attach-card">
            <div class="attach-media">
              <img v-if="item.kind === 'image'" :src="item.previewUrl" alt="参考图" />
              <div v-else class="attach-video-fallback">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <span class="attach-kind">{{ item.kind === 'image' ? '图片' : '视频' }}</span>
            </div>
            <div class="attach-meta">
              <div class="attach-name" :title="item.name">{{ item.name }}</div>
              <div class="role-row">
                <span class="role-label">角色</span>
                <BaseSelect
                  v-model="item.role"
                  :options="roleOptionsFor(item.kind)"
                  placeholder="选择角色"
                  :searchable="false"
                  class="role-select"
                />
              </div>
            </div>
            <div class="attach-actions">
              <button type="button" class="btn btn-sm btn-ghost" :disabled="submitting" @click="removeAttachment(item.id)">移除</button>
            </div>
          </div>
        </div>

        <div class="output-row">
          <span class="prompt-label">输出类型</span>
          <div class="output-tabs">
            <button
              type="button"
              :class="['output-tab', { active: outputType === 'image' }]"
              :disabled="submitting"
              @click="outputType = 'image'"
            >生成图片</button>
            <button
              type="button"
              :class="['output-tab', { active: outputType === 'video' }]"
              :disabled="submitting"
              @click="outputType = 'video'"
            >生成视频</button>
          </div>
        </div>

        <label class="prompt-field">
          <span class="prompt-label">改写提示</span>
          <textarea
            v-model="prompt"
            class="composer-input"
            rows="5"
            :placeholder="promptPlaceholder"
            :disabled="submitting"
            @keydown.ctrl.enter.prevent="submit"
            @keydown.meta.enter.prevent="submit"
          />
        </label>

        <div class="composer-foot">
          <div class="composer-meta">
            <span class="mode-pill" :class="{ active: attachments.length > 0 }">{{ modeLabel }}</span>
            <div class="model-select-wrap">
              <BaseSelect
                v-model="selectedConfigId"
                :options="modelSelectOptions"
                :placeholder="modelSelectPlaceholder"
                :searchable="flatModelOptions.length > 5"
                class="model-select"
              />
            </div>
          </div>
          <button
            type="button"
            class="send-btn"
            :disabled="!canSubmit"
            :title="submitDisabledReason"
            @click="submit"
          >
            <span v-if="submitting" class="attach-spinner light" />
            <template v-else>
              <span>开始生成</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </template>
          </button>
        </div>
      </section>

      <section v-if="job" class="create-result" :class="job.status">
        <div class="result-head">
          <div class="result-title-wrap">
            <span class="result-dot" />
            <div>
              <div class="result-title">{{ statusLabel }}</div>
              <div class="result-desc">{{ resultDesc }}</div>
            </div>
          </div>
          <a
            v-if="job.status === 'completed' && resultUrl"
            class="btn btn-sm"
            :href="resultUrl"
            download
            target="_blank"
            rel="noopener"
          >下载结果</a>
        </div>

        <p v-if="job.error_msg || job.errorMsg" class="result-error">{{ job.error_msg || job.errorMsg }}</p>

        <div v-else-if="job.status === 'processing' || job.status === 'pending'" class="result-pending">
          <div class="pending-bar"><span /></div>
          <p>模型正在处理你的参考素材，通常需要几十秒到几分钟</p>
        </div>

        <div v-else-if="job.status === 'completed' && resultUrl" class="result-media">
          <img v-if="(job.kind || job.output_type) === 'image'" :src="resultUrl" alt="生成结果" class="result-image" />
          <video v-else :src="resultUrl" class="result-video" controls playsinline />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import { aiConfigAPI, createAPI, uploadAPI } from '~/composables/useApi'
import BaseSelect from '~/components/BaseSelect.vue'

definePageMeta({ layout: 'default' })

const MAX_IMAGES = 9
const MAX_VIDEOS = 3

const IMAGE_ROLES = [
  { label: '人物参考', value: 'character' },
  { label: '场景参考', value: 'scene' },
  { label: '风格参考', value: 'style' },
  { label: '补充参考', value: 'extra' },
]

const VIDEO_ROLES = [
  { label: '主视频', value: 'main_video' },
  { label: '补充视频', value: 'ref_video' },
]

const fileInputRef = ref(null)
const prompt = ref('')
const uploading = ref(false)
const submitting = ref(false)
const dragOver = ref(false)
const attachments = ref([])
const outputType = ref('image')
const job = ref(null)
const imageConfigs = ref([])
const videoConfigs = ref([])
const selectedConfigId = ref('')
let pollTimer = null
let dragDepth = 0
let attachSeq = 0

/** 从配置记录解析模型名 */
function parseConfigModel(config) {
  if (!config) return ''
  const raw = config.model
  if (Array.isArray(raw)) return String(raw[0] || '')
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '[]')
      return Array.isArray(parsed) ? String(parsed[0] || '') : String(parsed || '')
    } catch {
      return raw
    }
  }
  return ''
}

/** 配置下拉展示文案 */
function configOptionLabel(config) {
  const modelName = parseConfigModel(config)
  if (modelName) return `${modelName} · ${config.provider}`
  return `${config.name || '未命名'} · ${config.provider}`
}

/** 是否启用中的配置 */
function isConfigActive(config) {
  return config?.is_active !== false && config?.isActive !== false
}

function roleOptionsFor(kind) {
  return kind === 'video' ? VIDEO_ROLES : IMAGE_ROLES
}

const imageCount = computed(() => attachments.value.filter((item) => item.kind === 'image').length)
const videoCount = computed(() => attachments.value.filter((item) => item.kind === 'video').length)

const modelSelectOptions = computed(() => {
  const list = (outputType.value === 'video' ? videoConfigs.value : imageConfigs.value)
    .filter(isConfigActive)
  return list.map((config) => ({
    label: configOptionLabel(config),
    value: config.id,
  }))
})

const flatModelOptions = computed(() => modelSelectOptions.value)

const modelSelectPlaceholder = computed(() => {
  if (!flatModelOptions.value.length) {
    return outputType.value === 'video'
      ? '暂无视频模型，请先在设置中添加'
      : '暂无图片模型，请先在设置中添加'
  }
  return '选择模型'
})

const modeLabel = computed(() => {
  if (!attachments.value.length) return '等待参考素材'
  return `${imageCount.value} 图 · ${videoCount.value} 视频`
})

const promptPlaceholder = computed(() => {
  if (outputType.value === 'video') {
    return '例如：保留主视频运镜，人物换成图中角色，背景换成图中场景…'
  }
  return '例如：把多张参考图整合成一张，人物用图1，场景用图2…'
})

const canSubmit = computed(() => {
  if (uploading.value || submitting.value) return false
  if (!prompt.value.trim()) return false
  if (!selectedConfigId.value) return false
  if (outputType.value === 'image') return imageCount.value > 0 && imageCount.value <= MAX_IMAGES
  return (imageCount.value > 0 || videoCount.value > 0)
    && imageCount.value <= MAX_IMAGES
    && videoCount.value <= MAX_VIDEOS
})

const submitDisabledReason = computed(() => {
  if (uploading.value) return '上传中'
  if (submitting.value) return '生成中'
  if (!attachments.value.length) return '请先上传图片或视频'
  if (outputType.value === 'image' && imageCount.value === 0) return '生成图片至少需要一张参考图'
  if (outputType.value === 'video' && imageCount.value === 0 && videoCount.value === 0) {
    return '生成视频至少需要一段视频或一张参考图'
  }
  if (imageCount.value > MAX_IMAGES) return `图片最多 ${MAX_IMAGES} 张`
  if (videoCount.value > MAX_VIDEOS) return `视频最多 ${MAX_VIDEOS} 段`
  if (!prompt.value.trim()) return '请输入提示词'
  if (!selectedConfigId.value) return '请选择模型'
  return '开始生成'
})

const statusLabel = computed(() => {
  const status = job.value?.status
  if (status === 'completed') return '生成完成'
  if (status === 'failed') return '生成失败'
  if (status === 'processing' || status === 'pending') return '正在生成'
  return status || ''
})

const resultDesc = computed(() => {
  const status = job.value?.status
  if (status === 'completed') return '结果已就绪，可预览或下载'
  if (status === 'failed') return '请检查提示词或更换参考素材后重试'
  return '任务已提交，请稍候'
})

const resultUrl = computed(() => {
  const path = job.value?.result_path || job.value?.resultPath
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
})

/** 默认角色：首个视频为主视频，其余为补充；图片默认补充参考 */
function defaultRoleFor(kind) {
  if (kind === 'image') return 'extra'
  const hasMain = attachments.value.some((item) => item.kind === 'video' && item.role === 'main_video')
  return hasMain ? 'ref_video' : 'main_video'
}

function syncSelectedConfig() {
  const options = flatModelOptions.value
  if (!options.length) {
    selectedConfigId.value = ''
    return
  }
  const current = options.find((item) => item.value === selectedConfigId.value)
  if (current) return
  selectedConfigId.value = options[0].value
}

watch(modelSelectOptions, () => {
  syncSelectedConfig()
})

watch(outputType, () => {
  syncSelectedConfig()
})

async function loadConfigs() {
  try {
    const [imgCfgs, vidCfgs] = await Promise.all([
      aiConfigAPI.list('image'),
      aiConfigAPI.list('video'),
    ])
    imageConfigs.value = Array.isArray(imgCfgs) ? imgCfgs : (imgCfgs?.items || [])
    videoConfigs.value = Array.isArray(vidCfgs) ? vidCfgs : (vidCfgs?.items || [])
    syncSelectedConfig()
  } catch (e) {
    toast.error(e?.message || '加载模型配置失败')
  }
}

function clearPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function clearAttachments() {
  for (const item of attachments.value) {
    if (item.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
  }
  attachments.value = []
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function removeAttachment(id) {
  const target = attachments.value.find((item) => item.id === id)
  if (target?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl)
  attachments.value = attachments.value.filter((item) => item.id !== id)
}

function onDragEnter() {
  dragDepth += 1
  dragOver.value = true
}

function onDragOver() {
  dragOver.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragOver.value = false
}

async function onDrop(event) {
  dragDepth = 0
  dragOver.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length) await handleFiles(files)
}

async function onFileChange(event) {
  const input = event.target
  const files = Array.from(input?.files || [])
  if (input) input.value = ''
  if (!files.length) return
  await handleFiles(files)
}

async function handleFiles(files) {
  uploading.value = true
  let added = 0
  try {
    for (const file of files) {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
      if (!isImage && !isVideo) {
        toast.error(`${file.name} 不是支持的图片或视频`)
        continue
      }
      if (isImage && imageCount.value + added >= MAX_IMAGES) {
        toast.info(`图片最多 ${MAX_IMAGES} 张`)
        break
      }
      if (isVideo && videoCount.value >= MAX_VIDEOS) {
        toast.info(`视频最多 ${MAX_VIDEOS} 段`)
        continue
      }

      const uploaded = isImage ? await uploadAPI.image(file) : await uploadAPI.video(file)
      const kind = isImage ? 'image' : 'video'
      attachments.value.push({
        id: `a-${Date.now()}-${attachSeq++}`,
        kind,
        role: defaultRoleFor(kind),
        name: file.name,
        path: uploaded.path,
        previewUrl: isImage
          ? (uploaded.url.startsWith('/') ? uploaded.url : `/${uploaded.path}`)
          : '',
      })
      added += 1
    }
    if (added) toast.success(`已添加 ${added} 个素材`)
  } catch (e) {
    toast.error(e?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function pollJob(jobId) {
  clearPoll()
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => {
      pollTimer = setTimeout(r, 4000)
    })
    try {
      const res = await createAPI.get(jobId)
      job.value = res
      if (res?.status === 'completed') {
        toast.success('生成完成')
        submitting.value = false
        return
      }
      if (res?.status === 'failed') {
        toast.error(res?.error_msg || res?.errorMsg || '生成失败')
        submitting.value = false
        return
      }
    } catch (e) {
      if (i === 119) {
        toast.error(e?.message || '轮询超时')
        submitting.value = false
        return
      }
    }
  }
  toast.error('生成超时')
  submitting.value = false
}

async function submit() {
  if (!canSubmit.value) {
    toast.info(submitDisabledReason.value)
    return
  }
  submitting.value = true
  job.value = null
  try {
    const res = await createAPI.submit({
      prompt: prompt.value.trim(),
      output_type: outputType.value,
      config_id: Number(selectedConfigId.value),
      assets: attachments.value.map((item) => ({
        path: item.path,
        kind: item.kind,
        role: item.role,
      })),
    })
    job.value = res
    toast.success('任务已提交')
    if (res?.id) pollJob(res.id)
    else submitting.value = false
  } catch (e) {
    submitting.value = false
    toast.error(e?.message || '提交失败')
  }
}

onMounted(() => {
  loadConfigs()
})

onBeforeUnmount(() => {
  clearPoll()
  clearAttachments()
})
</script>

<style scoped>
.create-page {
  min-height: calc(100vh - 56px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px 72px;
  overflow: auto;
}

.create-stage {
  width: min(920px, 100%);
  display: flex;
  flex-direction: column;
  gap: 28px;
  animation: rise-in 0.45s var(--ease-out);
}

.create-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.create-kicker {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-text);
}

.create-title {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 36px);
  font-weight: 700;
  color: var(--text-0);
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.create-sub {
  max-width: 480px;
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.6;
}

.create-composer {
  background: var(--bg-0);
  border: 1px solid var(--panel-border);
  border-radius: 24px;
  box-shadow: var(--shadow-panel);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), transform 0.2s var(--ease-out);
}

.create-composer.is-dragover {
  border-color: rgba(76, 125, 255, 0.45);
  box-shadow: 0 0 0 4px var(--accent-bg), var(--shadow-panel);
  transform: translateY(-1px);
}

.asset-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.composer-empty {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 96px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1.5px dashed var(--border-strong);
  background:
    linear-gradient(180deg, rgba(248, 251, 255, 0.9), rgba(238, 243, 249, 0.65));
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
}

.composer-empty.compact {
  min-height: 72px;
  padding: 14px 16px;
}

.composer-empty:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.upload-mark {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-0);
  border: 1px solid var(--border);
  color: var(--accent-text);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.composer-empty.compact .upload-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

.upload-mark.busy {
  border-color: rgba(76, 125, 255, 0.25);
}

.upload-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.upload-copy strong {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-0);
}

.upload-copy span {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.attach-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 320px;
  overflow: auto;
}

.attach-card {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border-radius: 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
}

.attach-media {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-2);
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.attach-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.attach-video-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-text);
  background:
    radial-gradient(circle at 30% 30%, rgba(122, 167, 255, 0.35), transparent 55%),
    var(--bg-2);
}

.attach-kind {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(24, 33, 50, 0.72);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
}

.attach-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attach-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.role-label {
  font-size: 12px;
  color: var(--text-3);
  flex-shrink: 0;
}

.role-row :deep(.base-select) {
  flex: 1;
  min-width: 0;
}

.role-row :deep(.base-select-trigger) {
  min-height: 32px;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.attach-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.output-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.output-tabs {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: var(--bg-2);
  border: 1px solid var(--border);
}

.output-tab {
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
}

.output-tab.active {
  background: var(--bg-0);
  color: var(--accent-text);
  box-shadow: var(--shadow-xs);
}

.prompt-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.composer-input {
  width: 100%;
  border: 1px solid var(--border);
  outline: none;
  resize: vertical;
  min-height: 140px;
  background: var(--bg-input);
  border-radius: 14px;
  padding: 16px 18px;
  font-size: 15px;
  line-height: 1.65;
  color: var(--text-0);
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.composer-input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.composer-input::placeholder {
  color: var(--text-3);
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 2px;
}

.composer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.mode-pill.active {
  background: var(--accent-bg);
  border-color: rgba(76, 125, 255, 0.22);
  color: var(--accent-text);
}

.model-select-wrap {
  min-width: 220px;
  max-width: min(360px, 48vw);
}

.model-select-wrap :deep(.base-select-trigger) {
  min-height: 34px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--bg-2);
  border-color: var(--border);
  font-size: 12px;
}

.model-select-wrap :deep(.base-select-label) {
  font-size: 12px;
}

.send-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 124px;
  height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  border: none;
  background: var(--accent-gradient);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 24px var(--accent-glow);
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px var(--accent-glow);
}

.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.attach-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.attach-spinner.light {
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
}

.create-result {
  background: var(--bg-0);
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  box-shadow: var(--shadow-sm);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: rise-in 0.35s var(--ease-out);
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.result-title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.result-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.create-result.completed .result-dot { background: var(--success); }
.create-result.failed .result-dot { background: var(--error); }
.create-result.processing .result-dot,
.create-result.pending .result-dot {
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-bg);
  animation: pulse 1.4s ease-in-out infinite;
}

.result-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-0);
}

.result-desc {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}

.result-error {
  color: var(--error);
  font-size: 13px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--error-bg);
}

.result-pending {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0 4px;
}

.result-pending p {
  font-size: 13px;
  color: var(--text-2);
}

.pending-bar {
  height: 4px;
  border-radius: 999px;
  background: var(--bg-2);
  overflow: hidden;
}

.pending-bar span {
  display: block;
  width: 40%;
  height: 100%;
  border-radius: inherit;
  background: var(--accent-gradient);
  animation: slide 1.2s ease-in-out infinite;
}

.result-media {
  display: flex;
  justify-content: center;
  background:
    linear-gradient(180deg, var(--bg-1), var(--bg-2));
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.result-image,
.result-video {
  max-width: 100%;
  max-height: 480px;
  display: block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

@keyframes slide {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}

@media (max-width: 640px) {
  .create-page {
    padding: 24px 14px 56px;
  }

  .create-composer {
    padding: 14px;
    border-radius: 20px;
  }

  .composer-empty {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .attach-card {
    grid-template-columns: 64px 1fr;
  }

  .attach-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }

  .output-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .composer-foot {
    flex-direction: column;
    align-items: stretch;
  }

  .send-btn {
    width: 100%;
  }
}
</style>
