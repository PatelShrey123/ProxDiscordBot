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
 * Translates all text fields of an Embed object or EmbedBuilder in-place to typewriter font.
 */
export function convertEmbedInPlace(embed) {
  if (!embed) return embed;

  // 1. If it has a .data property (like EmbedBuilder class)
  if (embed.data && typeof embed.data === 'object') {
    if (embed.data.title) embed.data.title = toTypewriter(embed.data.title);
    if (embed.data.description) embed.data.description = toTypewriter(embed.data.description);
    
    if (embed.data.author && embed.data.author.name) {
      embed.data.author.name = toTypewriter(embed.data.author.name);
    }
    
    if (embed.data.footer && embed.data.footer.text) {
      embed.data.footer.text = toTypewriter(embed.data.footer.text);
    }
    
    if (embed.data.fields && Array.isArray(embed.data.fields)) {
      embed.data.fields.forEach(field => {
        if (field.name) field.name = toTypewriter(field.name);
        if (field.value) field.value = toTypewriter(field.value);
      });
    }
  } else if (typeof embed === 'object') {
    // 2. If it is a raw JSON embed object
    if (embed.title) embed.title = toTypewriter(embed.title);
    if (embed.description) embed.description = toTypewriter(embed.description);
    
    if (embed.author && embed.author.name) {
      embed.author.name = toTypewriter(embed.author.name);
    }
    
    if (embed.footer && embed.footer.text) {
      embed.footer.text = toTypewriter(embed.footer.text);
    }
    
    if (embed.fields && Array.isArray(embed.fields)) {
      embed.fields.forEach(field => {
        if (field.name) field.name = toTypewriter(field.name);
        if (field.value) field.value = toTypewriter(field.value);
      });
    }
  }
  
  return embed;
}
