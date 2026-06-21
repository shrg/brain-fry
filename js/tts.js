// Brain Fry — слой озвучки (§4). Web Speech API + обходы багов iOS Safari.
// Абстрагирован так, чтобы в v2 заменить на банк аудио без правок логики сессии.

import { CONFIG } from "./config.js";
import { pick } from "./util.js";

export class TTS {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.supported = !!this.synth && typeof SpeechSynthesisUtterance !== "undefined";
    this.voices = [];
    this._resumeTimer = null;
    this._primed = false;

    if (this.supported) {
      this._loadVoices();
      // голоса приходят асинхронно — ждём voiceschanged (§4.2)
      if (typeof this.synth.onvoiceschanged !== "undefined") {
        this.synth.onvoiceschanged = () => this._loadVoices();
      }
      // повторные попытки — iOS отдаёт голоса не сразу
      [250, 1000, 2500].forEach((t) => setTimeout(() => this._loadVoices(), t));

      // обрыв в фоне — сбрасываем речь (§4.2)
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.cancel();
      });
    }
  }

  _loadVoices() {
    if (!this.supported) return;
    this.voices = (this.synth.getVoices() || []).filter((v) => /^en(-|_|$)/i.test(v.lang));
  }

  // Все найденные en-голоса (для диагностики в настройках).
  allEnVoices() { return this.voices.slice(); }

  // «Настоящие» дикторы: без приколов-голосов (§4.1).
  usableVoices() {
    return this.voices.filter((v) => CONFIG.noveltyVoices.indexOf(v.name) === -1);
  }

  // Выбор голоса под режим. random работает только если годных голосов > 1,
  // иначе тихий фолбэк на системный дефолт (null) — §4.1.
  chooseVoice(mode) {
    if (mode === "random") {
      const usable = this.usableVoices();
      if (usable.length > 1) return pick(usable);
      return null; // фолбэк
    }
    return null; // системный по умолчанию
  }

  // §4.2 «прайминг»: первый speak после пользовательского жеста (на «Старт»).
  prime() {
    if (!this.supported || this._primed) return;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; u.rate = 1;
      this.synth.speak(u);
      this._primed = true;
    } catch (e) { /* без шума */ }
  }

  cancel() {
    if (!this.supported) return;
    try { this.synth.cancel(); } catch (e) {}
    this._stopKeepalive();
  }

  /**
   * Произнести текст. Возвращает Promise, который резолвится по окончании речи
   * с { endTs } — временем конца озвучки (для msToFirstCorrect).
   */
  speak(text, { rate = 1.0, voice = null } = {}) {
    return new Promise((resolve) => {
      if (!this.supported) { resolve({ endTs: performance.now(), error: "unsupported" }); return; }
      this.cancel(); // защита: перед каждым speak (§4.2)

      const u = new SpeechSynthesisUtterance(text);
      u.lang = (voice && voice.lang) || "en-US";
      u.rate = rate;
      if (voice) u.voice = voice;

      let settled = false;
      const finish = (extra) => {
        if (settled) return;
        settled = true;
        this._stopKeepalive();
        resolve(Object.assign({ endTs: performance.now() }, extra));
      };

      u.onstart = () => this._startKeepalive();
      u.onend = () => finish({});
      u.onerror = (ev) => finish({ error: (ev && ev.error) || "error" });

      this.synth.speak(u);

      // если iOS промолчал (голоса не догрузились) — обновим список голосов
      setTimeout(() => {
        if (!this.synth.speaking && !this.synth.pending && !settled) this._loadVoices();
      }, 300);
    });
  }

  // периодический resume() от зависаний долгой речи (§4.2)
  _startKeepalive() {
    this._stopKeepalive();
    this._resumeTimer = setInterval(() => {
      if (this.synth.speaking) { try { this.synth.resume(); } catch (e) {} }
      else this._stopKeepalive();
    }, 4000);
  }
  _stopKeepalive() {
    if (this._resumeTimer) { clearInterval(this._resumeTimer); this._resumeTimer = null; }
  }
}
