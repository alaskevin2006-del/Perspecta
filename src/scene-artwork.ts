/** Geometry uses each artwork's background pixel coordinates; preserve source aspect ratios. */
const trioGeometry = {
  backgroundWidth: 1671, backgroundHeight: 941,
  left: 437.6, top: 424.83, width: 779.2,
  opacity: 1, feather: 30,
} as const;
export const approvedTrioArtwork = {
  ...trioGeometry,
  src: '/assets/characters/warm-conversation-patch.png',
  roleIds: ['zhang_xuefeng', 'lei_jun', 'wang_defeng'],
  sourceWidth: 1672, sourceHeight: 941,
} as const;
export const secondTrioArtwork = {
  ...trioGeometry,
  src: '/assets/characters/three-conversation-3-2.png',
  roleIds: ['du_sujuan', 'lei_jun', 'wang_defeng'],
  sourceWidth: 1666, sourceHeight: 944,
} as const;
export const thirdTrioArtwork = {
  ...trioGeometry,
  src: '/assets/characters/three-conversation-3-3.png',
  roleIds: ['zhang_xuefeng', 'lei_jun', 'du_sujuan'],
  sourceWidth: 1672, sourceHeight: 941,
} as const;
export const fourthTrioArtwork = {
  ...trioGeometry,
  src: '/assets/characters/three-conversation-3-4.png',
  roleIds: ['zhang_xuefeng', 'du_sujuan', 'wang_defeng'],
  sourceWidth: 1672, sourceHeight: 941,
} as const;
export const trioArtworks = [approvedTrioArtwork, secondTrioArtwork, thirdTrioArtwork, fourthTrioArtwork] as const;
export type TrioArtwork = typeof trioArtworks[number];
export const firstPairArtwork = {
  src: '/assets/characters/two-conversation-2-1.png',
  roleIds: ['lei_jun', 'wang_defeng'],
  backgroundWidth: 1672, backgroundHeight: 941,
  left: 447.71, top: 425.54, width: 777.67,
  sourceWidth: 1649, sourceHeight: 954,
  opacity: 1, feather: 30,
} as const;
export const secondPairArtwork = {
  ...firstPairArtwork,
  src: '/assets/characters/two-conversation-2-2.png?v=c0fe0e824a4c',
  roleIds: ['zhang_xuefeng', 'lei_jun'],
  left: 442.43, top: 425.51, width: 784.87,
  sourceWidth: 1672, sourceHeight: 941,
} as const;
export const thirdPairArtwork = {
  ...firstPairArtwork,
  src: '/assets/characters/two-conversation-2-3.png',
  roleIds: ['zhang_xuefeng', 'wang_defeng'],
  left: 447.81, top: 425.36, width: 777.5,
} as const;
export const fourthPairArtwork = {
  ...firstPairArtwork,
  src: '/assets/characters/two-conversation-2-4.png',
  roleIds: ['zhang_xuefeng', 'du_sujuan'],
  left: 448.8, top: 424.88, width: 774.72,
} as const;
export const fifthPairArtwork = {
  ...firstPairArtwork,
  src: '/assets/characters/two-conversation-2-5.png',
  roleIds: ['lei_jun', 'du_sujuan'],
  left: 447.99, top: 425.4, width: 777.57,
} as const;
export const sixthPairArtwork = {
  ...firstPairArtwork,
  src: '/assets/characters/two-conversation-2-6.png',
  roleIds: ['wang_defeng', 'du_sujuan'],
  left: 448.05, top: 425.55, width: 777.66,
} as const;
export const quartetArtwork = {
  src: '/assets/characters/four-conversation.png',
  roleIds: ['zhang_xuefeng', 'du_sujuan', 'lei_jun', 'wang_defeng'],
  backgroundWidth: 1671, backgroundHeight: 941,
  left: 446.49, top: 431.5, width: 776.57,
  sourceWidth: 1672, sourceHeight: 941,
  opacity: 1, feather: 30,
} as const;
export const sceneArtworks = [...trioArtworks, firstPairArtwork, secondPairArtwork, thirdPairArtwork, fourthPairArtwork, fifthPairArtwork, sixthPairArtwork, quartetArtwork] as const;
export type SceneArtwork = typeof sceneArtworks[number];
export function getSceneArtwork(ids: readonly string[]) {
  return new Set(ids).size === ids.length
    ? sceneArtworks.find(artwork => artwork.roleIds.length === ids.length && artwork.roleIds.every(id => ids.includes(id)))
    : undefined;
}
export function getTrioArtwork(ids: readonly string[]) {
  return ids.length === 3 && new Set(ids).size === 3
    ? trioArtworks.find(artwork => artwork.roleIds.every(id => ids.includes(id)))
    : undefined;
}
export function matchesApprovedTrio(ids: readonly string[]) {
  return getTrioArtwork(ids) !== undefined;
}
