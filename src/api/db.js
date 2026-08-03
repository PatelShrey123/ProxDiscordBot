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
