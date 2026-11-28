/** Decode bounded HTML entities in trusted public-source text for React text
 * nodes. Never render as HTML; React still escapes the resulting characters.
 */
const NAMED: Record<string,string> = {
  amp:'&', quot:'"', apos:"'", nbsp:' ', lt:'<', gt:'>',
  hellip:'…', mdash:'—', ndash:'–', rsquo:'’', lsquo:'‘',
  ldquo:'“', rdquo:'”', raquo:'»', laquo:'«', bull:'•',
};
export function frontierReadableText(input: string): string {
  return (input ?? '')
    .replace(/&#(x[\da-f]+|\d+);?/gi, (token, raw: string) => {
      const hex = raw.charAt(0).toLowerCase() === 'x';
      const code = Number.parseInt(hex ? raw.slice(1) : raw, hex ? 16 : 10);
      return code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : token;
    })
    .replace(/&([a-z]{2,8});/gi, (token, key: string) => NAMED[key.toLowerCase()] ?? token)
    .replace(/\s+/g, ' ').trim();
}
