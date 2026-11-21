// Sound, made not loaded: every blip is a WebAudio oscillator, so the game
// ships no audio files and makes no network request. The context is created
// on the first key or click, never before, and stays silent in screenshot
// mode where nobody pressed anything.
export function createAudio() {
  const audio = {
    context: null,
    master: null,
    muted: false,
    stepAlternate: false,
    /** Build the context on first use; returns false when audio is unavailable. */
    ensure() {
      if (audio.context) {
        if (audio.context.state === 'suspended') audio.context.resume().catch(() => {});
        return true;
      }
      try {
        const Context = window.AudioContext ?? window.webkitAudioContext;
        if (!Context) return false;
        audio.context = new Context();
        audio.master = audio.context.createGain();
        audio.master.gain.value = 0.16;
        audio.master.connect(audio.context.destination);
        return true;
      } catch {
        return false;
      }
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.16;
      return audio.muted;
    },
    /** A short tone: frequency, seconds, shape and slide-to frequency. */
    blip(frequency, duration, shape, slideTo) {
      if (audio.muted || !audio.ensure()) return;
      try {
        const now = audio.context.currentTime;
        const oscillator = audio.context.createOscillator();
        const gain = audio.context.createGain();
        oscillator.type = shape;
        oscillator.frequency.setValueAtTime(frequency, now);
        if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gain);
        gain.connect(audio.master);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
      } catch {
        // Audio is decoration: a failure here must never stop the game.
      }
    },
    /** A soft footstep, alternating pitch so walking has a rhythm. */
    footstep(sprinting) {
      audio.stepAlternate = !audio.stepAlternate;
      audio.blip(audio.stepAlternate ? 150 : 120, 0.07, 'sine', 70);
      if (sprinting) audio.blip(90, 0.05, 'triangle', 55);
    },
    /** The two-tone alarm when a warden gives chase. */
    alarm() {
      audio.blip(660, 0.16, 'square', 660);
      window.setTimeout(() => audio.blip(520, 0.2, 'square', 520), 170);
    },
    /** The chime when a ledger page is pocketed. */
    page() {
      audio.blip(880, 0.1, 'sine', 880);
      window.setTimeout(() => audio.blip(1318, 0.14, 'sine', 1318), 90);
    },
    /** The low thud of being caught. */
    caught() {
      audio.blip(220, 0.3, 'sawtooth', 55);
    },
    /** The little arpeggio of a clean getaway. */
    win() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((note, index) => {
        window.setTimeout(() => audio.blip(note, 0.22, 'sine', note), index * 130);
      });
    },
    /** A soft click for menus and the distraction ping. */
    click() {
      audio.blip(440, 0.06, 'triangle', 330);
    },
  };
  return audio;
}
