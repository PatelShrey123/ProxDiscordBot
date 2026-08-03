import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus 
} from '@discordjs/voice';
import play from 'play-dl';

// Map storing Music Guild Queue: key = guildId, value = QueueObject
const queues = new Map();

class GuildQueue {
  constructor(guildId, channel) {
    this.guildId = guildId;
    this.voiceChannel = channel;
    this.songs = [];
    this.connection = null;
    this.player = null;
    this.playing = false;
  }

  initConnection() {
    return new Promise((resolve, reject) => {
      try {
        this.connection = joinVoiceChannel({
          channelId: this.voiceChannel.id,
          guildId: this.guildId,
          adapterCreator: this.voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: false
        });

        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);

        this.player.on(AudioPlayerStatus.Idle, () => {
          this.playNext();
        });

        this.player.on('error', (error) => {
          console.error(`[Music] Audio player error:`, error.message);
          this.playNext();
        });

        this.connection.on(VoiceConnectionStatus.Disconnected, () => {
          this.destroy();
        });

        this.connection.once(VoiceConnectionStatus.Ready, () => {
          console.log(`[Music] Voice connection is ready in guild ${this.guildId}!`);
          resolve();
        });

        setTimeout(() => {
          if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Ready) {
            reject(new Error('Voice connection timeout'));
          }
        }, 10000);
      } catch (err) {
        reject(err);
      }
    });
  }

  async play(song) {
    this.songs.push(song);
    if (!this.playing) {
      this.playing = true;
      if (!this.connection) {
        try {
          await this.initConnection();
        } catch (err) {
          console.error(`[Music] Failed to connect:`, err.message);
          this.stop();
          return;
        }
      }
      await this.startStream();
    }
  }

  async startStream() {
    if (this.songs.length === 0) {
      this.playing = false;
      this.player?.stop();
      return;
    }

    const song = this.songs[0];
    try {
      // Fetch stream using play-dl (supports search queries or direct URLs!)
      let stream = null;
      if (song.url.startsWith('http://') || song.url.startsWith('https://')) {
        stream = await play.stream(song.url);
      } else {
        // Search Youtube for search strings
        const searchResult = await play.search(song.title, { limit: 1 });
        if (searchResult.length === 0) {
          throw new Error('No youtube results found.');
        }
        song.title = searchResult[0].title;
        song.url = searchResult[0].url;
        stream = await play.stream(searchResult[0].url);
      }

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });

      this.player.play(resource);
    } catch (err) {
      console.error('[Music] Failed to stream song:', err.message);
      this.songs.shift();
      await this.startStream();
    }
  }

  playNext() {
    this.songs.shift();
    this.startStream();
  }

  skip() {
    if (this.songs.length > 1) {
      this.player?.stop(); // Idle trigger will transition to next song
      return true;
    } else {
      this.stop();
      return false;
    }
  }

  stop() {
    this.songs = [];
    this.playing = false;
    this.player?.stop();
    this.connection?.destroy();
    this.connection = null;
    this.player = null;
    queues.delete(this.guildId);
  }

  destroy() {
    this.stop();
  }
}

export function getOrCreateQueue(guildId, voiceChannel) {
  if (queues.has(guildId)) {
    return queues.get(guildId);
  }
  const queue = new GuildQueue(guildId, voiceChannel);
  queues.set(guildId, queue);
  return queue;
}

export function getQueue(guildId) {
  return queues.get(guildId) || null;
}
