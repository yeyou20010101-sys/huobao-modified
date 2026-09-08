import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import type { AuthUser } from '../utils/session.js'

export type DramaRole = 'owner' | 'editor' | 'viewer'

export type DramaAccess = {
  drama: typeof schema.dramas.$inferSelect
  role: DramaRole
}

const WRITE_ROLES = new Set<DramaRole>(['owner', 'editor'])

export function canWriteRole(role: DramaRole): boolean {
  return WRITE_ROLES.has(role)
}

export function ensureDramaOwnerMember(dramaId: number, ownerId: number, invitedBy?: number) {
  const [existing] = db.select().from(schema.dramaMembers)
    .where(and(eq(schema.dramaMembers.dramaId, dramaId), eq(schema.dramaMembers.userId, ownerId)))
    .all()
  if (existing) return
  const ts = new Date().toISOString()
  db.insert(schema.dramaMembers).values({
    dramaId,
    userId: ownerId,
    role: 'owner',
    invitedBy: invitedBy ?? ownerId,
    createdAt: ts,
    updatedAt: ts,
  }).run()
}

export function getDramaAccess(dramaId: number, userId: number): DramaAccess | null {
  const [drama] = db.select().from(schema.dramas)
    .where(and(eq(schema.dramas.id, dramaId), isNull(schema.dramas.deletedAt)))
    .all()
  if (!drama) return null
  if (drama.userId === userId) return { drama, role: 'owner' }
  const [member] = db.select().from(schema.dramaMembers)
    .where(and(eq(schema.dramaMembers.dramaId, dramaId), eq(schema.dramaMembers.userId, userId)))
    .all()
  if (!member) return null
  const role = member.role as DramaRole
  if (role !== 'owner' && role !== 'editor' && role !== 'viewer') return null
  return { drama, role }
}

/** 成员可读（含 viewer） */
export function getOwnedDrama(dramaId: number, userId: number) {
  return getDramaAccess(dramaId, userId)?.drama ?? null
}

export function getWritableDrama(dramaId: number, userId: number) {
  const access = getDramaAccess(dramaId, userId)
  if (!access || !canWriteRole(access.role)) return null
  return access.drama
}

export function getOwnerDrama(dramaId: number, userId: number) {
  const access = getDramaAccess(dramaId, userId)
  if (!access || access.role !== 'owner') return null
  return access.drama
}

export function storageUserIdForDrama(
  drama: { userId: number | null } | null | undefined,
  fallbackUserId: number,
): number {
  const id = drama?.userId
  return typeof id === 'number' && id > 0 ? id : fallbackUserId
}

export function storageUserIdFromDramaId(dramaId: number | null | undefined, fallbackUserId: number): number {
  if (dramaId) {
    const [drama] = db.select().from(schema.dramas).where(eq(schema.dramas.id, dramaId)).all()
    return storageUserIdForDrama(drama, fallbackUserId)
  }
  return fallbackUserId
}

export function listAccessibleDramas(userId: number) {
  const memberIds = new Set(
    db.select().from(schema.dramaMembers)
      .where(eq(schema.dramaMembers.userId, userId))
      .all()
      .map(row => row.dramaId),
  )
  return db.select().from(schema.dramas)
    .where(isNull(schema.dramas.deletedAt))
    .all()
    .filter(drama => drama.userId === userId || memberIds.has(drama.id))
}

export function getMemberRole(dramaId: number, userId: number): DramaRole | null {
  return getDramaAccess(dramaId, userId)?.role ?? null
}

export function getOwnedEpisode(episodeId: number, userId: number) {
  const [episode] = db.select().from(schema.episodes)
    .where(eq(schema.episodes.id, episodeId))
    .all()
  if (!episode) return null
  const access = getDramaAccess(episode.dramaId, userId)
  if (!access) return null
  return { episode, drama: access.drama, role: access.role }
}

export function getWritableEpisode(episodeId: number, userId: number) {
  const owned = getOwnedEpisode(episodeId, userId)
  if (!owned || !canWriteRole(owned.role)) return null
  return owned
}

export function getOwnedStoryboard(storyboardId: number, userId: number) {
  const [storyboard] = db.select().from(schema.storyboards)
    .where(eq(schema.storyboards.id, storyboardId))
    .all()
  if (!storyboard) return null
  const owned = getOwnedEpisode(storyboard.episodeId, userId)
  if (!owned) return null
  return { storyboard, ...owned }
}

export function getWritableStoryboard(storyboardId: number, userId: number) {
  const owned = getOwnedStoryboard(storyboardId, userId)
  if (!owned || !canWriteRole(owned.role)) return null
  return owned
}

export function getOwnedCharacter(characterId: number, userId: number) {
  const [character] = db.select().from(schema.characters)
    .where(eq(schema.characters.id, characterId))
    .all()
  if (!character || character.deletedAt) return null
  const access = getDramaAccess(character.dramaId, userId)
  if (!access) return null
  return { character, drama: access.drama, role: access.role }
}

export function getWritableCharacter(characterId: number, userId: number) {
  const owned = getOwnedCharacter(characterId, userId)
  if (!owned || !canWriteRole(owned.role)) return null
  return owned
}

export function getOwnedScene(sceneId: number, userId: number) {
  const [scene] = db.select().from(schema.scenes)
    .where(eq(schema.scenes.id, sceneId))
    .all()
  if (!scene || scene.deletedAt) return null
  const access = getDramaAccess(scene.dramaId, userId)
  if (!access) return null
  return { scene, drama: access.drama, role: access.role }
}

export function getWritableScene(sceneId: number, userId: number) {
  const owned = getOwnedScene(sceneId, userId)
  if (!owned || !canWriteRole(owned.role)) return null
  return owned
}

function canAccessGenerationDrama(dramaId: number | null | undefined, userId: number): boolean {
  if (dramaId == null) return false
  return !!getDramaAccess(dramaId, userId)
}

export function getOwnedImageGeneration(id: number, userId: number) {
  const [row] = db.select().from(schema.imageGenerations)
    .where(eq(schema.imageGenerations.id, id))
    .all()
  if (!row) return null
  if (row.userId === userId || canAccessGenerationDrama(row.dramaId, userId)) return row
  return null
}

export function getOwnedVideoGeneration(id: number, userId: number) {
  const [row] = db.select().from(schema.videoGenerations)
    .where(eq(schema.videoGenerations.id, id))
    .all()
  if (!row) return null
  if (row.userId === userId || canAccessGenerationDrama(row.dramaId, userId)) return row
  return null
}

export function getOwnedCreateJob(id: number, userId: number) {
  const [row] = db.select().from(schema.createJobs)
    .where(eq(schema.createJobs.id, id))
    .all()
  if (!row || row.userId !== userId) return null
  return row
}

export function getOwnedAiConfig(id: number, userId: number) {
  const [row] = db.select().from(schema.aiServiceConfigs)
    .where(eq(schema.aiServiceConfigs.id, id))
    .all()
  if (!row || row.userId !== userId) return null
  return row
}

export function getOwnedAgentConfig(id: number, userId: number) {
  const [row] = db.select().from(schema.agentConfigs)
    .where(eq(schema.agentConfigs.id, id))
    .all()
  if (!row || row.userId !== userId) return null
  return row
}

/** 剧集锁定的配置必须属于当前用户，禁止借用他人 API Key */
export function assertUserOwnsConfigIds(
  user: AuthUser,
  configIds: Array<number | null | undefined>,
): boolean {
  for (const id of configIds) {
    if (id == null) continue
    if (!getOwnedAiConfig(id, user.id)) return false
  }
  return true
}

export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin'
}

/** 当前用户是否可读某位所有者目录下的共享素材 */
export function canReadOwnerStorage(readerId: number, ownerId: number): boolean {
  if (readerId === ownerId) return true
  const ownedDramaIds = db.select({ id: schema.dramas.id }).from(schema.dramas)
    .where(and(eq(schema.dramas.userId, ownerId), isNull(schema.dramas.deletedAt)))
    .all()
    .map(row => row.id)
  if (!ownedDramaIds.length) return false
  const member = db.select().from(schema.dramaMembers)
    .where(eq(schema.dramaMembers.userId, readerId))
    .all()
    .some(row => ownedDramaIds.includes(row.dramaId))
  return member
}
