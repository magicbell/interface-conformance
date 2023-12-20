function isUpperCaseAtoZ(char: string) {
  const code = char.charCodeAt(0);
  return code >= 65 && code <= 90;
}

export function getFuncSignature(code: string): string {
  let depth = 0;
  
  for (let idx = 0; idx < code.length; idx++) {
    const char = code[idx];

    if (char === '(') {
      depth++;
      continue;
    }

    if (char === ')') {
      depth--;
      continue;
    }

    if (depth > 0) continue;
    if (isUpperCaseAtoZ(char)) return code.slice(idx).replace(/{\s?$/, '').trim();
  }

  return '';
}