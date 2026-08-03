import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || 'https://qauzfpzwxmmfjtbyidvp.supabase.co';
const key = process.env.SUPABASE_KEY || 'sb_publishable_Mp7DKTgSQXK6OmUd27a-sw_4JfMyjgJ';

async function request(path, method = 'GET', body = null) {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${url}/rest/v1/${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Database error (${response.status}): ${text}`);
  }

  return response.json();
}

// ==========================================
// 1. Leveling & Yap Tracking (yap_levels)
// ==========================================

export async function getYapLevel(guildId, userId, username) {
  try {
    const data = await request(`yap_levels?guild_id=eq.${guildId}&user_id=eq.${userId}`);
    if (data.length > 0) return data[0];

    // If not exists, insert a default starting row
    const inserted = await request('yap_levels', 'POST', {
      guild_id: guildId,
      user_id: userId,
      username: username || 'Unknown',
      message_count: 0,
      xp: 0,
      level: 0,
      last_message_at: new Date().toISOString()
    });
    return inserted[0];
  } catch (err) {
    console.error(`[DB] getYapLevel error for user ${userId}:`, err.message);
    // Fallback in-memory representation if DB fails to make the bot robust
    return { guild_id: guildId, user_id: userId, username: username || 'Unknown', message_count: 1, xp: 10, level: 0 };
  }
}

export async function updateYapXp(guildId, userId, username, xpToAdd) {
  const current = await getYapLevel(guildId, userId, username);
  
  const newXp = (current.xp || 0) + xpToAdd;
  const newMsgCount = (current.message_count || 0) + 1;
  
  // XP formula: XP threshold = 5 * (Level^2) + 50 * Level + 100
  let level = current.level || 0;
  let didLevelUp = false;

  while (true) {
    const threshold = 5 * (level * level) + 50 * level + 100;
    if (newXp >= threshold) {
      level++;
      didLevelUp = true;
    } else {
      break;
    }
  }

  try {
    const updated = await request(`yap_levels?guild_id=eq.${guildId}&user_id=eq.${userId}`, 'PATCH', {
      xp: newXp,
      message_count: newMsgCount,
      level: level,
      username: username || current.username,
      last_message_at: new Date().toISOString()
    });
    return { data: updated[0] || current, didLevelUp, newLevel: level };
  } catch (err) {
    console.error(`[DB] updateYapXp error for user ${userId}:`, err.message);
    return { data: { ...current, xp: newXp, message_count: newMsgCount, level }, didLevelUp, newLevel: level };
  }
}

export async function getYapLeaderboard(guildId) {
  try {
    return await request(`yap_levels?guild_id=eq.${guildId}&order=xp.desc&limit=10`);
  } catch (err) {
    console.error(`[DB] getYapLeaderboard error:`, err.message);
    return [];
  }
}

// ==========================================
// 2. Moderation History (moderation_history)
// ==========================================

export async function addModerationAction(guildId, userId, moderatorId, action, reason) {
  try {
    const inserted = await request('moderation_history', 'POST', {
      guild_id: guildId,
      user_id: userId,
      moderator_id: moderatorId,
      action: action.toUpperCase(),
      reason: reason || 'No reason provided',
      created_at: new Date().toISOString()
    });
    return inserted[0];
  } catch (err) {
    console.error(`[DB] addModerationAction error:`, err.message);
    return null;
  }
}

export async function getModerationHistory(guildId, userId, limit = 3) {
  try {
    return await request(`moderation_history?guild_id=eq.${guildId}&user_id=eq.${userId}&order=created_at.desc&limit=${limit}`);
  } catch (err) {
    console.error(`[DB] getModerationHistory error:`, err.message);
    return [];
  }
}

// ==========================================
// 3. Giveaways (giveaways)
// ==========================================

export async function createGiveaway(guildId, channelId, messageId, prize, winnerCount, endsAt) {
  try {
    const inserted = await request('giveaways', 'POST', {
      guild_id: guildId,
      channel_id: channelId,
      message_id: messageId,
      prize,
      winner_count: parseInt(winnerCount) || 1,
      ends_at: new Date(endsAt).toISOString(),
      status: 'ACTIVE',
      winners: []
    });
    return inserted[0];
  } catch (err) {
    console.error(`[DB] createGiveaway error:`, err.message);
    return null;
  }
}

export async function getActiveGiveaways() {
  try {
    // Fetch giveaways ending before or at this moment that are still ACTIVE
    const nowIso = new Date().toISOString();
    return await request(`giveaways?status=eq.ACTIVE&ends_at=lte.${nowIso}`);
  } catch (err) {
    console.error(`[DB] getActiveGiveaways error:`, err.message);
    return [];
  }
}

export async function getGiveaway(messageId) {
  try {
    const data = await request(`giveaways?message_id=eq.${messageId}`);
    return data[0] || null;
  } catch (err) {
    console.error(`[DB] getGiveaway error:`, err.message);
    return null;
  }
}

export async function updateGiveawayWinners(messageId, winnersArray) {
  try {
    const updated = await request(`giveaways?message_id=eq.${messageId}`, 'PATCH', {
      status: 'ENDED',
      winners: winnersArray
    });
    return updated[0];
  } catch (err) {
    console.error(`[DB] updateGiveawayWinners error:`, err.message);
    return null;
  }
}

// ==========================================
// 4. Jail System (jail_records)
// ==========================================

export async function saveJailRecord(guildId, userId, rolesArray) {
  try {
    await request(`jail_records?guild_id=eq.${guildId}&user_id=eq.${userId}`, 'DELETE');
    const inserted = await request('jail_records', 'POST', {
      guild_id: guildId,
      user_id: userId,
      roles: rolesArray,
      jailed_at: new Date().toISOString()
    });
    return inserted[0];
  } catch (err) {
    console.error(`[DB] saveJailRecord error:`, err.message);
    return null;
  }
}

export async function getJailRecord(guildId, userId) {
  try {
    const data = await request(`jail_records?guild_id=eq.${guildId}&user_id=eq.${userId}`);
    return data[0] || null;
  } catch (err) {
    console.error(`[DB] getJailRecord error:`, err.message);
    return null;
  }
}

export async function removeJailRecord(guildId, userId) {
  try {
    const deleted = await request(`jail_records?guild_id=eq.${guildId}&user_id=eq.${userId}`, 'DELETE');
    return deleted;
  } catch (err) {
    console.error(`[DB] removeJailRecord error:`, err.message);
    return null;
  }
}

export async function getModeratorActions(guildId, moderatorId, limit = 3) {
  try {
    return await request(`moderation_history?guild_id=eq.${guildId}&moderator_id=eq.${moderatorId}&order=created_at.desc&limit=${limit}`);
  } catch (err) {
    console.error(`[DB] getModeratorActions error:`, err.message);
    return [];
  }
}

// ==========================================
// 5. Guild Settings (guild_settings)
// ==========================================

export async function getLevelRewardsStatus(guildId) {
  try {
    const data = await request(`guild_settings?guild_id=eq.${guildId}`);
    if (data.length > 0) return data[0].level_rewards_enabled !== false;
    return true; // Default to true
  } catch (err) {
    console.error(`[DB] getLevelRewardsStatus error:`, err.message);
    return true;
  }
}

export async function setLevelRewardsStatus(guildId, enabled) {
  try {
    // Attempt to update
    const data = await request(`guild_settings?guild_id=eq.${guildId}`);
    if (data.length > 0) {
      await request(`guild_settings?guild_id=eq.${guildId}`, 'PATCH', {
        level_rewards_enabled: enabled
      });
    } else {
      await request('guild_settings', 'POST', {
        guild_id: guildId,
        level_rewards_enabled: enabled
      });
    }
    return true;
  } catch (err) {
    console.error(`[DB] setLevelRewardsStatus error:`, err.message);
    return false;
  }
}

export async function getLevelTrackingStatus(guildId) {
  try {
    const data = await request(`guild_settings?guild_id=eq.${guildId}`);
    if (data.length > 0) return data[0].level_tracking_enabled !== false;
    return true; // Default to true
  } catch (err) {
    console.error(`[DB] getLevelTrackingStatus error:`, err.message);
    return true;
  }
}

export async function setLevelTrackingStatus(guildId, enabled) {
  try {
    const data = await request(`guild_settings?guild_id=eq.${guildId}`);
    if (data.length > 0) {
      await request(`guild_settings?guild_id=eq.${guildId}`, 'PATCH', {
        level_tracking_enabled: enabled
      });
    } else {
      await request('guild_settings', 'POST', {
        guild_id: guildId,
        level_tracking_enabled: enabled
      });
    }
    return true;
  } catch (err) {
    console.error(`[DB] setLevelTrackingStatus error:`, err.message);
    return false;
  }
}

export async function getGuildSettings(guildId) {
  try {
    const data = await request(`guild_settings?guild_id=eq.${guildId}`);
    if (data.length > 0) return data[0];
    const inserted = await request('guild_settings', 'POST', {
      guild_id: guildId,
      level_rewards_enabled: true,
      last_daily_reset: '',
      last_weekly_reset: 0
    });
    return inserted[0];
  } catch (err) {
    console.error(`[DB] getGuildSettings error:`, err.message);
    return { guild_id: guildId, level_rewards_enabled: true, last_daily_reset: '', last_weekly_reset: 0 };
  }
}

export async function updateGuildResetSettings(guildId, dailyResetStr, weeklyResetWeek) {
  try {
    const updated = await request(`guild_settings?guild_id=eq.${guildId}`, 'PATCH', {
      last_daily_reset: dailyResetStr,
      last_weekly_reset: weeklyResetWeek
    });
    return updated[0];
  } catch (err) {
    console.error(`[DB] updateGuildResetSettings error:`, err.message);
    return null;
  }
}

// ==========================================
// 6. Daily/Weekly Yaps (daily_weekly_yaps)
// ==========================================

export async function incrementDailyWeeklyCount(guildId, userId, username) {
  try {
    const data = await request(`daily_weekly_yaps?guild_id=eq.${guildId}&user_id=eq.${userId}`);
    if (data.length > 0) {
      const updated = await request(`daily_weekly_yaps?guild_id=eq.${guildId}&user_id=eq.${userId}`, 'PATCH', {
        daily_count: (data[0].daily_count || 0) + 1,
        weekly_count: (data[0].weekly_count || 0) + 1,
        username: username || data[0].username
      });
      return updated[0];
    } else {
      const inserted = await request('daily_weekly_yaps', 'POST', {
        guild_id: guildId,
        user_id: userId,
        username: username || 'Unknown',
        daily_count: 1,
        weekly_count: 1
      });
      return inserted[0];
    }
  } catch (err) {
    console.error(`[DB] incrementDailyWeeklyCount error:`, err.message);
    return null;
  }
}

export async function getDailyWeeklyLeaderboard(guildId, type, limit = 5) {
  try {
    const sortCol = type === 'daily' ? 'daily_count' : 'weekly_count';
    return await request(`daily_weekly_yaps?guild_id=eq.${guildId}&order=${sortCol}.desc&limit=${limit}`);
  } catch (err) {
    console.error(`[DB] getDailyWeeklyLeaderboard error:`, err.message);
    return [];
  }
}

export async function resetDailyCounts(guildId) {
  try {
    // Supabase REST client doesn't support bulk PATCH easily without filter matching,
    // so we can set daily_count = 0 for everyone in the guild by filter matching guild_id.
    // If it requires update, we PATCH matching guild_id
    await request(`daily_weekly_yaps?guild_id=eq.${guildId}`, 'PATCH', {
      daily_count: 0
    });
    return true;
  } catch (err) {
    console.error(`[DB] resetDailyCounts error:`, err.message);
    return false;
  }
}

export async function resetWeeklyCounts(guildId) {
  try {
    await request(`daily_weekly_yaps?guild_id=eq.${guildId}`, 'PATCH', {
      weekly_count: 0
    });
    return true;
  } catch (err) {
    console.error(`[DB] resetWeeklyCounts error:`, err.message);
    return false;
  }
}

// ==========================================
// 7. Member Roles Backup (member_roles_backup)
// ==========================================

export async function saveRolesBackup(guildId, userId, rolesArray) {
  try {
    await request(`member_roles_backup?guild_id=eq.${guildId}&user_id=eq.${userId}`, 'DELETE');
    const inserted = await request('member_roles_backup', 'POST', {
      guild_id: guildId,
      user_id: userId,
      roles: rolesArray,
      saved_at: new Date().toISOString()
    });
    return inserted[0];
  } catch (err) {
    console.error(`[DB] saveRolesBackup error:`, err.message);
    return null;
  }
}

export async function getRolesBackup(guildId, userId) {
  try {
    const data = await request(`member_roles_backup?guild_id=eq.${guildId}&user_id=eq.${userId}`);
    return data[0] || null;
  } catch (err) {
    console.error(`[DB] getRolesBackup error:`, err.message);
    return null;
  }
}

export async function removeRolesBackup(guildId, userId) {
  try {
    await request(`member_roles_backup?guild_id=eq.${guildId}&user_id=eq.${userId}`, 'DELETE');
    return true;
  } catch (err) {
    console.error(`[DB] removeRolesBackup error:`, err.message);
    return false;
  }
}

export async function cleanExpiredBackups() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await request(`member_roles_backup?saved_at=lt.${thirtyDaysAgo}`, 'DELETE');
    return true;
  } catch (err) {
    console.error(`[DB] cleanExpiredBackups error:`, err.message);
    return false;
  }
}
