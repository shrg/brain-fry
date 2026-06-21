// Brain Fry — кастомная экранная клавиатура (§5.2). Грид, НЕ нативная iOS.
// Точка активна всегда; для категорий без копеек точку игнорируем на валидации.

export class Keypad {
  /**
   * @param {HTMLElement} container  куда рендерить
   * @param {object} handlers  { onChange(value), onSubmit(value) }
   */
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers || {};
    this.value = "";
    this.allowDot = true;
    this._render();
  }

  setAllowDot(flag) {
    this.allowDot = !!flag;
    this.container.classList.toggle("no-dot", !this.allowDot);
  }

  clear() { this.value = ""; this._emit(); }
  get() { return this.value; }

  _render() {
    this.container.classList.add("keypad");
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
    this.container.innerHTML = "";
    for (const k of keys) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key" + (k === "." ? " key-dot" : "") + (k === "back" ? " key-back" : "");
      btn.dataset.key = k;
      btn.textContent = k === "back" ? "⌫" : k;
      btn.setAttribute("aria-label", k === "back" ? "Стереть" : k === "." ? "точка" : k);
      btn.addEventListener("click", () => this._press(k));
      this.container.appendChild(btn);
    }

    // поддержка физической клавиатуры на десктопе (бонус)
    this._keyListener = (e) => {
      if (e.key >= "0" && e.key <= "9") { this._press(e.key); e.preventDefault(); }
      else if (e.key === ".") { this._press("."); e.preventDefault(); }
      else if (e.key === "Backspace") { this._press("back"); e.preventDefault(); }
      else if (e.key === "Enter") { this.handlers.onSubmit && this.handlers.onSubmit(this.value); e.preventDefault(); }
    };
    document.addEventListener("keydown", this._keyListener);
  }

  _press(k) {
    if (k === "back") {
      this.value = this.value.slice(0, -1);
    } else if (k === ".") {
      if (this.allowDot && this.value.indexOf(".") === -1 && this.value !== "") this.value += ".";
    } else {
      // не больше 2 знаков после точки
      if (this.value.indexOf(".") !== -1 && this.value.split(".")[1].length >= 2) return;
      if (this.value.length >= 9) return;
      this.value += k;
    }
    this._emit();
  }

  _emit() {
    if (this.handlers.onChange) this.handlers.onChange(this.value);
  }

  destroy() {
    if (this._keyListener) document.removeEventListener("keydown", this._keyListener);
  }
}
