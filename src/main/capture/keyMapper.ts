// Modifier bitmask helpers for uiohook
export interface ModifierState {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean; // Cmd on macOS
}

/**
 * Hardcoded UiohookKey numeric constants — keeps uiohook-napi from being
 * loaded at module evaluation time (which triggers macOS Accessibility dialog).
 * Values sourced from uiohook-napi 1.5.4 UiohookKey enum.
 */
export const KEY = {
  // Letters
  A: 30, B: 48, C: 46, D: 32, E: 18, F: 33, G: 34, H: 35, I: 23, J: 36,
  K: 37, L: 38, M: 50, N: 49, O: 24, P: 25, Q: 16, R: 19, S: 31, T: 20,
  U: 22, V: 47, W: 17, X: 45, Y: 21, Z: 44,
  // Digits
  Digit0: 11, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5,
  Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10,
  // Punctuation
  Minus: 12, Equal: 13, BracketLeft: 26, BracketRight: 27,
  Backslash: 43, Semicolon: 39, Quote: 40, Backquote: 41,
  Comma: 51, Period: 52, Slash: 53, Space: 57,
  // Control
  Backspace: 14, Tab: 15, Enter: 28, Delete: 3667, Escape: 1,
  // Navigation
  ArrowLeft: 57419, ArrowRight: 57421, ArrowUp: 57416, ArrowDown: 57424,
  // Numpad
  Numpad0: 82, Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad4: 75,
  Numpad5: 76, Numpad6: 77, Numpad7: 71, Numpad8: 72, Numpad9: 73,
  NumpadAdd: 78, NumpadSubtract: 74, NumpadMultiply: 55,
  NumpadDivide: 3637, NumpadDecimal: 83, NumpadEnter: 3612,
  // Modifiers
  Shift: 42, ShiftRight: 54, Ctrl: 29, CtrlRight: 3613,
  Alt: 56, AltRight: 3640, Meta: 3675, MetaRight: 3676,
} as const;

export type UiohookKeyboardEventLike = { keycode: number };

const KEY_CHAR_MAP: Record<number, { normal: string; shift: string }> = {
  [KEY.Space]: { normal: ' ', shift: ' ' },
  [KEY.A]: { normal: 'a', shift: 'A' },
  [KEY.B]: { normal: 'b', shift: 'B' },
  [KEY.C]: { normal: 'c', shift: 'C' },
  [KEY.D]: { normal: 'd', shift: 'D' },
  [KEY.E]: { normal: 'e', shift: 'E' },
  [KEY.F]: { normal: 'f', shift: 'F' },
  [KEY.G]: { normal: 'g', shift: 'G' },
  [KEY.H]: { normal: 'h', shift: 'H' },
  [KEY.I]: { normal: 'i', shift: 'I' },
  [KEY.J]: { normal: 'j', shift: 'J' },
  [KEY.K]: { normal: 'k', shift: 'K' },
  [KEY.L]: { normal: 'l', shift: 'L' },
  [KEY.M]: { normal: 'm', shift: 'M' },
  [KEY.N]: { normal: 'n', shift: 'N' },
  [KEY.O]: { normal: 'o', shift: 'O' },
  [KEY.P]: { normal: 'p', shift: 'P' },
  [KEY.Q]: { normal: 'q', shift: 'Q' },
  [KEY.R]: { normal: 'r', shift: 'R' },
  [KEY.S]: { normal: 's', shift: 'S' },
  [KEY.T]: { normal: 't', shift: 'T' },
  [KEY.U]: { normal: 'u', shift: 'U' },
  [KEY.V]: { normal: 'v', shift: 'V' },
  [KEY.W]: { normal: 'w', shift: 'W' },
  [KEY.X]: { normal: 'x', shift: 'X' },
  [KEY.Y]: { normal: 'y', shift: 'Y' },
  [KEY.Z]: { normal: 'z', shift: 'Z' },
  [KEY.Digit0]: { normal: '0', shift: ')' },
  [KEY.Digit1]: { normal: '1', shift: '!' },
  [KEY.Digit2]: { normal: '2', shift: '@' },
  [KEY.Digit3]: { normal: '3', shift: '#' },
  [KEY.Digit4]: { normal: '4', shift: '$' },
  [KEY.Digit5]: { normal: '5', shift: '%' },
  [KEY.Digit6]: { normal: '6', shift: '^' },
  [KEY.Digit7]: { normal: '7', shift: '&' },
  [KEY.Digit8]: { normal: '8', shift: '*' },
  [KEY.Digit9]: { normal: '9', shift: '(' },
  [KEY.Minus]: { normal: '-', shift: '_' },
  [KEY.Equal]: { normal: '=', shift: '+' },
  [KEY.BracketLeft]: { normal: '[', shift: '{' },
  [KEY.BracketRight]: { normal: ']', shift: '}' },
  [KEY.Backslash]: { normal: '\\', shift: '|' },
  [KEY.Semicolon]: { normal: ';', shift: ':' },
  [KEY.Quote]: { normal: "'", shift: '"' },
  [KEY.Backquote]: { normal: '`', shift: '~' },
  [KEY.Comma]: { normal: ',', shift: '<' },
  [KEY.Period]: { normal: '.', shift: '>' },
  [KEY.Slash]: { normal: '/', shift: '?' },
  [KEY.Numpad0]: { normal: '0', shift: '0' },
  [KEY.Numpad1]: { normal: '1', shift: '1' },
  [KEY.Numpad2]: { normal: '2', shift: '2' },
  [KEY.Numpad3]: { normal: '3', shift: '3' },
  [KEY.Numpad4]: { normal: '4', shift: '4' },
  [KEY.Numpad5]: { normal: '5', shift: '5' },
  [KEY.Numpad6]: { normal: '6', shift: '6' },
  [KEY.Numpad7]: { normal: '7', shift: '7' },
  [KEY.Numpad8]: { normal: '8', shift: '8' },
  [KEY.Numpad9]: { normal: '9', shift: '9' },
  [KEY.NumpadAdd]: { normal: '+', shift: '+' },
  [KEY.NumpadSubtract]: { normal: '-', shift: '-' },
  [KEY.NumpadMultiply]: { normal: '*', shift: '*' },
  [KEY.NumpadDivide]: { normal: '/', shift: '/' },
  [KEY.NumpadDecimal]: { normal: '.', shift: '.' },
};

/**
 * Maps a uiohook keyboard event to an Inkwell token or printable character.
 */
export function mapKeyEventToToken(
  e: UiohookKeyboardEventLike,
  modifiers: ModifierState
): string | null {
  const { keycode } = e;
  const isShift = modifiers.shift;
  const isCmd = modifiers.meta;
  const isAlt = modifiers.alt;

  // 1. Command Combos
  if (isCmd) {
    if (keycode === KEY.A) return '[⌘A]';
    if (keycode === KEY.Z) return '[⌘Z]';
    if (keycode === KEY.Backspace) return '[⌘⌫]';
    // If other cmd combos (e.g. Cmd+C, Cmd+V), do not log printable letters as normal typing
    return null;
  }

  // 2. Option / Alt Combos
  if (isAlt) {
    if (keycode === KEY.Backspace) return '[⌥⌫]';
    // Ignore other option shortcuts or allow special character typing if needed
  }

  // 3. Navigation and Selection
  if (keycode === KEY.ArrowLeft) {
    return isShift ? '[⇧←]' : '[←]';
  }
  if (keycode === KEY.ArrowRight) {
    return isShift ? '[⇧→]' : '[→]';
  }
  if (keycode === KEY.ArrowUp) {
    return '[↑]';
  }
  if (keycode === KEY.ArrowDown) {
    return '[↓]';
  }

  // 4. Control Characters
  if (keycode === KEY.Backspace) {
    return '[⌫]';
  }
  if (keycode === KEY.Delete) {
    return '[⌦]';
  }
  if (keycode === KEY.Enter || keycode === KEY.NumpadEnter) {
    return '[↵]';
  }
  if (keycode === KEY.Tab) {
    return '[⇥]';
  }

  // 5. Printable Characters
  const mapping = KEY_CHAR_MAP[keycode];
  if (mapping) {
    return isShift ? mapping.shift : mapping.normal;
  }

  return null;
}
