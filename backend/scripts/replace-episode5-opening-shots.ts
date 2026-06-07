/**
 * 替换 episode 5（id=30）开场分镜：6 镜 → 8 镜（一人一镜 + 建立镜 + 登场/反应）
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'

const EPISODE_ID = 30
const SCENE_ID = 25

const CHAR = {
  chenZong: 9,
  chairman: 10,
  yu: 12,
  huang: 13,
  cheng: 14,
  cao: 15,
} as const

const OLD_OPENING_IDS = [278, 285, 286, 287, 288, 289]
const LATER_SHOTS: Array<{ id: number; newNumber: number }> = [
  { id: 279, newNumber: 9 },
  { id: 280, newNumber: 10 },
  { id: 281, newNumber: 11 },
  { id: 282, newNumber: 12 },
  { id: 283, newNumber: 13 },
]

type ShotDef = {
  storyboardNumber: number
  title: string
  shotType: string
  angle: string
  movement: string
  duration: number
  location: string
  time: string
  action: string
  description: string
  atmosphere: string
  imagePrompt: string
  videoPrompt: string
  bgmPrompt: string
  soundEffect: string
  dialogue?: string
  result?: string
  characterIds: number[]
}

const OPENING_SHOTS: ShotDef[] = [
  {
    storyboardNumber: 1,
    title: '会议室晨景',
    shotType: '全景',
    angle: '平视',
    movement: '缓慢推镜',
    duration: 3,
    location: '会议室',
    time: '清晨',
    action: '冷色调清晨，长桌两侧座椅整齐，无人说话，只有空调低鸣与远处城市声，气氛肃穆压抑。',
    description: '现代科技公司会议室全景，深色胡桃木长桌居中，落地玻璃幕墙外城市天际线，侧窗微光，空镜或远端人物虚焦不可辨认。',
    atmosphere: '冷色调，凝固感，决策前的静默。',
    imagePrompt: '全景平视，现代会议室清晨，长会议桌与皮质座椅对称排列，落地玻璃幕墙，侧窗冷色微光，空调感静音氛围，纯环境或极远虚焦人影，无清晰人脸，电影级构图',
    videoPrompt: '0-3秒：<location>会议室</location>全景，冷色调清晨，长桌与座椅静立，镜头缓慢推近，空调低鸣，无人对白。',
    bgmPrompt: '极低频弦乐铺底，几乎静止。',
    soundEffect: '空调低鸣、远处城市清晨环境声。',
    characterIds: [],
  },
  {
    storyboardNumber: 2,
    title: '董事长主位',
    shotType: '中景',
    angle: '平视',
    movement: '缓慢推镜',
    duration: 3,
    location: '会议室',
    time: '清晨',
    action: '董事长端坐长桌尽头主位，双手交叉置于桌沿，眉头微锁，神情沉稳严肃，静默坐镇。',
    description: '从长桌一侧望向桌首，董事长坐于主位椅子上，位于桌面后方，长桌占前景。',
    result: '确立会议主位权威感，为后续众人状态铺垫。',
    atmosphere: '清晨微光，肃穆安静，权威感。',
    imagePrompt: '中景平视，从长桌侧方望向桌首主位。董事长坐在长桌尽头皮质办公椅上，位于桌面后方，双手交叉轻放桌沿，眉头微锁。长桌占画面前景，侧窗微光，仅董事长一人清晰可见',
    videoPrompt: '0-3秒：<location>会议室</location>中景，<role>董事长</role>端坐主位，双手交叉置于桌面，神情沉稳，镜头缓慢推近。',
    bgmPrompt: '极低频弦乐铺底，几乎静止。',
    soundEffect: '空调低鸣、无对白。',
    characterIds: [CHAR.chairman],
  },
  {
    storyboardNumber: 3,
    title: '于总待命',
    shotType: '中景',
    angle: '平视',
    movement: '固定',
    duration: 3,
    location: '会议室',
    time: '清晨',
    action: '于总坐于长桌右侧席位，目光紧盯笔记本电脑屏幕，正襟危坐，待命准备。',
    description: '于总侧位中景，电脑屏幕与桌面资料可见，神情专注。',
    atmosphere: '专业、蓄势，战略研讨前的专注。',
    imagePrompt: '中景平视，于总坐长桌右侧席位，笔记本电脑已开，桌面有架构图与方案文件，目光专注屏幕，仅于总一人清晰入镜，侧窗冷光与会议室环境一致',
    videoPrompt: '0-3秒：<location>会议室</location>中景，<role>于总</role>坐右侧席位，紧盯电脑屏幕，正襟危坐，镜头固定。',
    bgmPrompt: '极低频弦乐持续，节奏平稳。',
    soundEffect: '电脑风扇低鸣、纸张轻微翻动。',
    characterIds: [CHAR.yu],
  },
  {
    storyboardNumber: 4,
    title: '黄宇哲研判',
    shotType: '近景',
    angle: '平视',
    movement: '固定',
    duration: 3,
    location: '会议室',
    time: '清晨',
    action: '黄宇哲低头翻阅市场数据报表，眉头微蹙，神情凝重。',
    description: '黄宇哲近景，专注报表，背景会议室虚焦。',
    atmosphere: '凝重、深度思考的静默。',
    imagePrompt: '近景平视，黄宇哲坐席位上低头翻阅报表，眉头微蹙，背景为虚焦会议室与桌沿，仅黄宇哲清晰，侧光打在脸上',
    videoPrompt: '0-3秒：<location>会议室</location>近景，<role>黄宇哲</role>低头翻阅市场数据报表，眉头微蹙，镜头固定。',
    bgmPrompt: '低频弦乐，极缓。',
    soundEffect: '纸张翻动声、轻微呼吸。',
    characterIds: [CHAR.huang],
  },
  {
    storyboardNumber: 5,
    title: '成立军沉思',
    shotType: '近景',
    angle: '平视',
    movement: '固定',
    duration: 3,
    location: '会议室',
    time: '清晨',
    action: '成立军怀中抱着厚厚项目资料，低头沉思，梳理问题。',
    description: '成立军近景，抱资料低头，务实稳重。',
    atmosphere: '务实、内敛的沉思感。',
    imagePrompt: '近景平视，成立军坐席位上怀中抱厚资料低头沉思，眉头微蹙，背景虚焦，仅成立军一人清晰，与会议室冷色调光影一致',
    videoPrompt: '0-3秒：<location>会议室</location>近景，<role>成立军</role>抱资料低头沉思，镜头固定。',
    bgmPrompt: '低频弦乐，极缓。',
    soundEffect: '资料页轻微摩擦声。',
    characterIds: [CHAR.cheng],
  },
  {
    storyboardNumber: 6,
    title: '曹总观察',
    shotType: '近景',
    angle: '平视',
    movement: '固定',
    duration: 2,
    location: '会议室',
    time: '清晨',
    action: '曹总背靠座椅，指尖转动签字笔，目光扫视，神色淡然观察。',
    description: '曹总近景，转笔观察，背景高管虚焦。',
    atmosphere: '淡然、审视，静压力。',
    imagePrompt: '近景平视，曹总背靠座椅，指尖转签字笔，目光侧向观察，神色淡然，背景为虚焦会议室与他人轮廓，仅曹总清晰',
    videoPrompt: '0-2秒：<location>会议室</location>近景，<role>曹总</role>背靠座椅转笔，淡然观察，镜头固定。',
    bgmPrompt: '极低频环境音，几乎无声。',
    soundEffect: '签字笔转动轻响、空调嗡鸣。',
    characterIds: [CHAR.cao],
  },
  {
    storyboardNumber: 7,
    title: '陈总推门',
    shotType: '全景转中景',
    angle: '平视',
    movement: '跟镜',
    duration: 5,
    location: '会议室',
    time: '清晨',
    action: '会议室门被急促推开，陈总大步走入，目光坚定，径直向场内。',
    description: '从门口全景跟拍陈总入画，穿深色职业套装，步伐利落。',
    result: '叙事转折点，打破压抑静默，主角正式入场。',
    atmosphere: '节奏骤然加快，破局感，紧张被打破。',
    imagePrompt: '全景转中景，会议室玻璃门被推开，陈总（中年女性、深色职业套装、干练）从门口大步走入，位于门与长桌之间的通道上，尚未落座，侧窗冷光打轮廓，仅陈总一人清晰',
    videoPrompt: '0-3秒：门被急促推开，<location>会议室</location>全景，<role>陈总</role>大步步入，目光坚定。<n>3-5秒：跟镜至中景，陈总向长桌方向走去，脚步声清晰。',
    bgmPrompt: '弦乐轻微上扬，短促节奏强调转折。',
    soundEffect: '门轴声、急促脚步声、衣物摩擦声。',
    characterIds: [CHAR.chenZong],
  },
  {
    storyboardNumber: 8,
    title: '抬眸示意',
    shotType: '中景',
    angle: '平视',
    movement: '固定',
    duration: 3,
    location: '会议室',
    time: '清晨',
    action: '董事长抬眸看向门口，语气沉稳，手势示意陈总入座。',
    description: '董事长主位中景，视线转向门口方向。',
    dialogue: '董事长：这不正商量着吗，你来得正好，一起讨论讨论。',
    atmosphere: '弦乐略抬，对白留空间，接纳主角入场。',
    imagePrompt: '中景平视，董事长坐主位抬眸望向门口方向，一手微抬示意入座，神情沉稳，仅董事长清晰，背景虚焦',
    videoPrompt: '0-3秒：<location>会议室</location>中景，<role>董事长</role>抬眸看向门口，沉稳抬手示意入座。',
    bgmPrompt: '弦乐持续，略抬。',
    soundEffect: '环境音略收，留对白空间。',
    characterIds: [CHAR.chairman],
  },
]

function syncCharacters(storyboardId: number, characterIds: number[]) {
  db.delete(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))
    .run()
  for (const characterId of [...new Set(characterIds)]) {
    db.insert(schema.storyboardCharacters).values({ storyboardId, characterId }).run()
  }
}

function main() {
  const ts = new Date().toISOString()

  for (const id of OLD_OPENING_IDS) {
    db.delete(schema.storyboardCharacters).where(eq(schema.storyboardCharacters.storyboardId, id)).run()
    db.delete(schema.storyboards).where(eq(schema.storyboards.id, id)).run()
  }

  for (const { id, newNumber } of LATER_SHOTS) {
    db.update(schema.storyboards)
      .set({ storyboardNumber: newNumber, updatedAt: ts })
      .where(eq(schema.storyboards.id, id))
      .run()
  }

  for (const shot of OPENING_SHOTS) {
    const res = db.insert(schema.storyboards).values({
      episodeId: EPISODE_ID,
      sceneId: SCENE_ID,
      storyboardNumber: shot.storyboardNumber,
      title: shot.title,
      description: shot.description,
      shotType: shot.shotType,
      angle: shot.angle,
      movement: shot.movement,
      action: shot.action,
      dialogue: shot.dialogue || null,
      result: shot.result || null,
      atmosphere: shot.atmosphere,
      imagePrompt: shot.imagePrompt,
      videoPrompt: shot.videoPrompt,
      bgmPrompt: shot.bgmPrompt,
      soundEffect: shot.soundEffect,
      location: shot.location,
      time: shot.time,
      duration: shot.duration,
      status: 'pending',
      createdAt: ts,
      updatedAt: ts,
    }).run()

    syncCharacters(Number(res.lastInsertRowid), shot.characterIds)
  }

  const rows = db.select({
    id: schema.storyboards.id,
    num: schema.storyboards.storyboardNumber,
    title: schema.storyboards.title,
  }).from(schema.storyboards)
    .where(eq(schema.storyboards.episodeId, EPISODE_ID))
    .all()
    .filter((row) => {
      const [full] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, row.id)).all()
      return !full?.deletedAt
    })
    .sort((a, b) => a.num - b.num)

  console.log(`Episode ${EPISODE_ID} storyboards (${rows.length} total):`)
  for (const row of rows) {
    const links = db.select().from(schema.storyboardCharacters)
      .where(eq(schema.storyboardCharacters.storyboardId, row.id)).all()
    const names = links.map((l) => {
      const [c] = db.select().from(schema.characters).where(eq(schema.characters.id, l.characterId)).all()
      return c?.name || String(l.characterId)
    }).join('、') || '—'
    console.log(`  #${row.num} ${row.title} [${names}]`)
  }
}

main()
