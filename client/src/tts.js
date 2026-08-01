// Browser text-to-speech (Web Speech API) helpers, tuned for this app's
// bilingual English + Bengali content. Everything no-ops safely when the API
// is missing so callers never have to guard themselves.

const BENGALI_RE = /[ঀ-৿]/; // any Bengali Unicode code point

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// getVoices() is often empty on first call and only populates once the async
// 'voiceschanged' event fires. Cache what we get and refresh on that event so
// speak() always sees the latest list.
let voiceCache = [];

function refreshVoices() {
  if (!ttsSupported()) return;
  try {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length) voiceCache = v;
  } catch {
    /* ignore — some engines throw before they're ready */
  }
}

if (ttsSupported()) {
  refreshVoices();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  } catch {
    // Older engines only expose the onvoiceschanged property.
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
}

// Pick the best available voice for a BCP-47 language prefix (e.g. 'bn', 'en').
// Returns null when nothing matches — the utterance's own .lang still applies.
function pickVoice(prefix) {
  if (!voiceCache.length) refreshVoices();
  return voiceCache.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix)) || null;
}

// Cancel anything currently speaking or queued.
export function stopSpeaking() {
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

// Speak `text`, cancelling any in-progress speech first. Bilingual values stored
// as "English line\nBangla line" are split per line so each line is spoken with a
// language (and voice) that matches its script.
export function speak(text) {
  if (!ttsSupported() || text == null) return;
  const str = String(text);
  if (!str.trim()) return;

  stopSpeaking();

  const lines = str.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const isBengali = BENGALI_RE.test(line);
    const u = new SpeechSynthesisUtterance(line);
    const voice = pickVoice(isBengali ? 'bn' : 'en');
    // Prefer a matching installed voice; otherwise fall back to a sensible lang
    // tag (bn-BD, then bn-IN, for Bengali) so the engine can still try.
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || (isBengali ? 'bn-BD' : 'en-US');
    } else {
      u.lang = isBengali ? 'bn-BD' : 'en-US';
    }
    u.rate = 0.95;
    try {
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore — queue the rest regardless */
    }
  }
}
