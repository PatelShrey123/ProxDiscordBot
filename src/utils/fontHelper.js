import { EmbedBuilder } from 'discord.js';

/**
 * Converts standard alphanumeric characters to Unicode Mathematical Monospace (Typewriter) characters.
 * This formats text in Nothing Phone typewriter-style font while preserving Discord markdown.
 */
export function toTypewriter(text) {
  if (!text) return '';
  
  // Skip formatting inside mentions, emojis, or URLs to prevent breaking them
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    // Skip Discord mentions (<@...>, <#...>, <:emoji:...>)
    if (text[i] === '<' && i + 1 < text.length && (text[i+1] === '@' || text[i+1] === '#' || text[i+1] === ':' || text[i+1] === 'a')) {
      while (i < text.length && text[i] !== '>') {
        result += text[i];
        i++;
      }
      if (i < text.length) {
        result += text[i];
        i++;
      }
      continue;
    }
    
    // Skip URLs (http:// or https://)
    if (text.substr(i, 7) === 'http://' || text.substr(i, 8) === 'https://') {
      while (i < text.length && text[i] !== ' ' && text[i] !== '\n') {
        result += text[i];
        i++;
      }
      continue;
    }

    const char = text[i];
    const code = char.charCodeAt(0);
    
    if (code >= 65 && code <= 90) { // A-Z
      result += String.fromCodePoint(code - 65 + 0x1D670);
    } else if (code >= 97 && code <= 122) { // a-z
      result += String.fromCodePoint(code - 97 + 0x1D68A);
    } else if (code >= 48 && code <= 57) { // 0-9
      result += String.fromCodePoint(code - 48 + 0x1D7F6);
    } else {
      result += char;
    }
    i++;
  }
  
  return result;
}

/**
 * Translates all text fields of an EmbedBuilder into typewriter font.
 */
export function convertEmbed(embed) {
  const data = embed.toJSON();
  const newEmbed = new EmbedBuilder();
  
  if (data.color) newEmbed.setColor(data.color);
  if (data.title) newEmbed.setTitle(toTypewriter(data.title));
  if (data.description) newEmbed.setDescription(toTypewriter(data.description));
  if (data.url) newEmbed.setURL(data.url);
  if (data.timestamp) newEmbed.setTimestamp(new Date(data.timestamp));
  
  if (data.thumbnail) newEmbed.setThumbnail(data.thumbnail.url);
  if (data.image) newEmbed.setImage(data.image.url);
  
  if (data.author) {
    newEmbed.setAuthor({
      name: toTypewriter(data.author.name),
      iconURL: data.author.icon_url,
      url: data.author.url
    });
  }
  
  if (data.footer) {
    newEmbed.setFooter({
      text: toTypewriter(data.footer.text),
      iconURL: data.footer.icon_url
    });
  }
  
  if (data.fields && data.fields.length > 0) {
    newEmbed.addFields(
      data.fields.map(field => ({
        name: toTypewriter(field.name),
        value: toTypewriter(field.value),
        inline: field.inline
      }))
    );
  }
  
  return newEmbed;
}
