import { isTypingTarget } from "@/lib/city/input";

/** WASD / look input plus a Shift flag that mouse events are not allowed to clear. */
export class InputKeys {
  private pressed = new Set<string>();
  private shift = false;

  down(event: KeyboardEvent) {
    this.pressed.add(event.code);
    this.noteShift(event, true);
  }

  up(event: KeyboardEvent) {
    this.pressed.delete(event.code);
    this.noteShift(event, false);
  }

  clear() {
    this.pressed.clear();
    this.shift = false;
  }

  has(...codes: string[]) {
    return codes.some((code) => this.pressed.has(code));
  }

  get running() {
    return this.shift;
  }

  /**
   * Shift keydowns are often missing under pointer lock. Latch on Shift itself
   * or on any key event that reports the modifier; only Shift keyup (or
   * `clear`) turns it off — never mousemove.
   */
  private noteShift(event: KeyboardEvent, down: boolean) {
    if (isShiftKey(event)) {
      this.shift = down || event.shiftKey || event.getModifierState("Shift");
      return;
    }
    if (event.shiftKey || event.getModifierState("Shift")) this.shift = true;
  }
}

function isShiftKey(event: KeyboardEvent) {
  return event.key === "Shift" || event.code === "ShiftLeft" || event.code === "ShiftRight";
}

export function attachPointerInput(
  canvas: HTMLCanvasElement,
  controls: {
    look(dx: number, dy: number): void;
    keyDown(event: KeyboardEvent): void;
    keyUp(event: KeyboardEvent): void;
    clearKeys(): void;
  },
  handlers: {
    setLocked: (locked: boolean) => void;
    /** Return true to keep the key from also moving the walker. */
    consumeKey?: (event: KeyboardEvent) => boolean;
  },
) {
  canvas.tabIndex = 0;
  const capture = true;

  const onPointerMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== canvas) return;
    controls.look(event.movementX, event.movementY);
  };
  const onLockChange = () => {
    const active = document.pointerLockElement === canvas;
    handlers.setLocked(active);
    if (active) canvas.focus();
    else controls.clearKeys();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape") return;
    const typing = isTypingTarget(event.target);
    if (!typing && (event.code.startsWith("Arrow") || event.code === "Space")) event.preventDefault();
    if (handlers.consumeKey?.(event)) return;
    if (typing) return;
    controls.keyDown(event);
  };
  const onKeyUp = (event: KeyboardEvent) => controls.keyUp(event);
  const onBlur = () => controls.clearKeys();

  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("pointerlockchange", onLockChange);
  document.addEventListener("keydown", onKeyDown, capture);
  document.addEventListener("keyup", onKeyUp, capture);
  window.addEventListener("blur", onBlur);

  return () => {
    document.removeEventListener("mousemove", onPointerMove);
    document.removeEventListener("pointerlockchange", onLockChange);
    document.removeEventListener("keydown", onKeyDown, capture);
    document.removeEventListener("keyup", onKeyUp, capture);
    window.removeEventListener("blur", onBlur);
  };
}
