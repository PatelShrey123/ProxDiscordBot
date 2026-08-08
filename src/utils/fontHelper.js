/**
 * Converts standard alphanumeric characters to Unicode Mathematical Monospace (Typewriter) characters.
 * This formats text in Nothing Phone typewriter-style font while preserving Discord markdown.
 */
export function toTypewriter(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  let result = '';
  let i = 0;
  
  while (i < str.length) {
    // Skip Discord mentions (<@...>, <#...>, <:emoji:...>)
    if (str[i] === '<' && i + 1 < str.length && (str[i+1] === '@' || str[i+1] === '#' || str[i+1] === ':' || str[i+1] === 'a')) {
      while (i < str.length && str[i] !== '>') {
        result += str[i];
        i++;
      }
      if (i < str.length) {
        result += str[i];
        i++;
      }
      continue;
    }
    
    // Skip URLs (http:// or https://)
    if (str.substr(i, 7) === 'http://' || str.substr(i, 8) === 'https://') {
      while (i < str.length && str[i] !== ' ' && str[i] !== '\n') {
        result += str[i];
        i++;
      }
      continue;
    }

    const char = str[i];
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
 * Translates all text fields of an Embed object into a formatted plain JSON embed.
 * This avoids mutating the original static global objects.
 */
export function convertEmbedToJSON(embed) {
  if (!embed) return embed;
  
  let data;
  if (typeof embed.toJSON === 'function') {
    data = embed.toJSON();
  } else if (typeof embed === 'object') {
    data = { ...embed };
  } else {
    return embed;
  }
  
  // Clone data properties to prevent modifying the original static embed object!
  const cloned = { ...data };
  
  if (cloned.title) cloned.title = toTypewriter(cloned.title);
  if (cloned.description) cloned.description = toTypewriter(cloned.description);
  
  if (cloned.author) {
    cloned.author = { ...cloned.author };
    if (cloned.author.name) cloned.author.name = toTypewriter(cloned.author.name);
  }
  
  if (cloned.footer) {
    cloned.footer = { ...cloned.footer };
    if (cloned.footer.text) cloned.footer.text = toTypewriter(cloned.footer.text);
  }
  
  if (cloned.fields && Array.isArray(cloned.fields)) {
    cloned.fields = cloned.fields.map(field => {
      const clonedField = { ...field };
      if (clonedField.name) clonedField.name = toTypewriter(clonedField.name);
      if (clonedField.value) clonedField.value = toTypewriter(clonedField.value);
      return clonedField;
    });
  }
  
  return cloned;
}
