/**
 * WatchBox Cinema Subtitle Engine
 * Adheres to Netflix Timed Text, BBC, and FCC Closed Captioning Standards.
 * 
 * Features:
 * - Strips SSA/ASS position & style override tags (e.g. {\an8}, {\pos(..)}, {\c&H...})
 * - Strips hardcoded <font ...> and </font> tags so user-customized high-contrast colors apply
 * - Normalizes formatting tags (<i>, <b>, <u>) and prevents raw tags from displaying as text
 * - Cleans subtitle scraper ads and promo watermarks (Wyzie, OpenSubtitles, Subscene, etc.)
 * - Standardizes timestamps to WebVTT specification (00:00:00.000)
 */

export function cleanSubtitleVtt(content, { stripAllTags = false } = {}) {
  if (!content || typeof content !== 'string') return '';

  // 1. Remove UTF-8 BOM if present
  let cleaned = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  // 2. Normalize CRLF to LF
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Remove ASS/SSA style override tags like {\an8}, {\pos(100,200)}, {\c&Hffffff&}, {\i1}, {\i0}, {\b1}, {\b0}
  cleaned = cleaned.replace(/\{[\\\/]?[^}]+\}/g, '');

  // 4. Strip <font ...> and </font> tags so viewer's high-contrast theme color is respected
  cleaned = cleaned.replace(/<\/?font[^>]*>/gi, '');

  if (stripAllTags) {
    // Strip all HTML/WebVTT tags completely
    cleaned = cleaned.replace(/<[^>]+>/g, '');
  } else {
    // Normalize standard subtitle formatting tags
    cleaned = cleaned.replace(/<(\/?)i>/gi, (m, slash) => `<${slash}i>`);
    cleaned = cleaned.replace(/<(\/?)b>/gi, (m, slash) => `<${slash}b>`);
    cleaned = cleaned.replace(/<(\/?)u>/gi, (m, slash) => `<${slash}u>`);
    cleaned = cleaned.replace(/<(\/?)em>/gi, (m, slash) => `<${slash}i>`);
    cleaned = cleaned.replace(/<(\/?)strong>/gi, (m, slash) => `<${slash}b>`);

    // Strip unhandled/unsafe tags (e.g. <c.yellow>, <v Speaker>, <span ...>, <script ...>) while preserving inner text
    cleaned = cleaned.replace(/<(?![\/]?(?:i|b|u)\b)[^>]+>/gi, '');
  }

  // 5. Convert comma timestamps to periods for WebVTT compliance: 00:00:00,000 -> 00:00:00.000
  cleaned = cleaned.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  // 6. Strip numeric sequence counters in SRT format (e.g. "1\n00:01:23.456")
  cleaned = cleaned.replace(/^\d+\n(?=\d{2}:\d{2}:\d{2})/gm, '');

  // 7. Strip trailing spaces
  cleaned = cleaned.replace(/[ \t]+$/gm, '');

  // 8. Ensure WEBVTT header
  cleaned = cleaned.trim();
  if (!cleaned.startsWith('WEBVTT')) {
    cleaned = 'WEBVTT\n\n' + cleaned;
  }

  // 9. Split into cue blocks and filter out promotional ad/spam blocks
  const blocks = cleaned.split(/\n\n+/);
  const filteredBlocks = blocks.filter((block, idx) => {
    if (idx === 0 && block.startsWith('WEBVTT')) return true;
    const lower = block.toLowerCase();
    const isAd =
      lower.includes('wyzie') ||
      lower.includes('opensubtitles') ||
      lower.includes('subscene') ||
      lower.includes('yify') ||
      lower.includes('addic7ed') ||
      lower.includes('advertis') ||
      lower.includes('downloaded from') ||
      lower.includes('translated by') ||
      lower.includes('sync & corrections') ||
      lower.includes('sync and correct') ||
      lower.includes('ripped by') ||
      lower.includes('free plan. unlock') ||
      lower.includes('store.wyzie') ||
      lower.includes('vip member');
    return !isAd;
  });

  return filteredBlocks.join('\n\n') + '\n';
}

export function stripHtmlTags(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<[^>]+>/g, '').replace(/\{[\\\/]?[^}]+\}/g, '').trim();
}
