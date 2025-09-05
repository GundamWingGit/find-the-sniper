/**
 * Level progression system for Find the Sniper
 */

export type LevelInfo = {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number; // 0-1 progress within current level
};

/**
 * Calculate XP required for a given level
 * Uses exponential growth: base XP * (level ^ exponent)
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  
  const baseXp = 100;
  const exponent = 1.5;
  
  return Math.floor(baseXp * Math.pow(level - 1, exponent));
}

/**
 * Calculate level and progress from total XP
 */
export function levelProgress(totalXp: number): LevelInfo {
  if (totalXp < 0) totalXp = 0;
  
  let level = 1;
  let currentLevelXp = 0;
  
  // Find the current level
  while (true) {
    const nextLevelXp = xpForLevel(level + 1);
    if (totalXp < nextLevelXp) {
      break;
    }
    level++;
    currentLevelXp = nextLevelXp;
  }
  
  const nextLevelXp = xpForLevel(level + 1);
  const xpInCurrentLevel = totalXp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  
  const progress = xpNeededForNextLevel > 0 ? xpInCurrentLevel / xpNeededForNextLevel : 0;
  
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progress: Math.max(0, Math.min(1, progress))
  };
}

/**
 * Get level from total XP (convenience function)
 */
export function getLevelFromXp(totalXp: number): number {
  return levelProgress(totalXp).level;
}

/**
 * Get level from total XP (alias for getLevelFromXp)
 */
export function levelForXp(totalXp: number): number {
  return levelProgress(totalXp).level;
}

/**
 * Calculate XP needed to reach a specific level
 */
export function xpNeededForLevel(targetLevel: number): number {
  return xpForLevel(targetLevel);
}
