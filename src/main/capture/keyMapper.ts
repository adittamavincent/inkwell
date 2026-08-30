import { UiohookKey, UiohookKeyboardEvent } from 'uiohook-napi';

// Modifier bitmask helpers for uiohook
export interface ModifierState {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean; // Cmd on macOS
}

const KEY_CHAR_MAP: Record<number, { normal: string; shift: string }> = {
  [UiohookKey.Space]: { normal: ' ', shift: ' ' },
  [UiohookKey.A]: { normal: 'a', shift: 'A' },
  [UiohookKey.B]: { normal: 'b', shift: 'B' },
  [UiohookKey.C]: { normal: 'c', shift: 'C' },
  [UiohookKey.D]: { normal: 'd', shift: 'D' },
  [UiohookKey.E]: { normal: 'e', shift: 'E' },
  [UiohookKey.F]: { normal: 'f', shift: 'F' },
  [UiohookKey.G]: { normal: 'g', shift: 'G' },
  [UiohookKey.H]: { normal: 'h', shift: 'H' },
  [UiohookKey.I]: { normal: 'i', shift: 'I' },
  [UiohookKey.J]: { normal: 'j', shift: 'J' },
  [UiohookKey.K]: { normal: 'k', shift: 'K' },
  [UiohookKey.L]: { normal: 'l', shift: 'L' },
  [UiohookKey.M]: { normal: 'm', shift: 'M' },
  [UiohookKey.N]: { normal: 'n', shift: 'N' },
  [UiohookKey.O]: { normal: 'o', shift: 'O' },
  [UiohookKey.P]: { normal: 'p', shift: 'P' },
  [UiohookKey.Q]: { normal: 'q', shift: 'Q' },
  [UiohookKey.R]: { normal: 'r', shift: 'R' },
  [UiohookKey.S]: { normal: 's', shift: 'S' },
  [UiohookKey.T]: { normal: 't', shift: 'T' },
  [UiohookKey.U]: { normal: 'u', shift: 'U' },
  [UiohookKey.V]: { normal: 'v', shift: 'V' },
  [UiohookKey.W]: { normal: 'w', shift: 'W' },
  [UiohookKey.X]: { normal: 'x', shift: 'X' },
  [UiohookKey.Y]: { normal: 'y', shift: 'Y' },
  [UiohookKey.Z]: { normal: 'z', shift: 'Z' },
  [UiohookKey['0']]: { normal: '0', shift: ')' },
  [UiohookKey['1']]: { normal: '1', shift: '!' },
  [UiohookKey['2']]: { normal: '2', shift: '@' },
  [UiohookKey['3']]: { normal: '3', shift: '#' },
  [UiohookKey['4']]: { normal: '4', shift: '$' },
  [UiohookKey['5']]: { normal: '5', shift: '%' },
  [UiohookKey['6']]: { normal: '6', shift: '^' },
  [UiohookKey['7']]: { normal: '7', shift: '&' },
  [UiohookKey['8']]: { normal: '8', shift: '*' },
  [UiohookKey['9']]: { normal: '9', shift: '(' },
  [UiohookKey.Minus]: { normal: '-', shift: '_' },
  [UiohookKey.Equal]: { normal: '=', shift: '+' },
  [UiohookKey.BracketLeft]: { normal: '[', shift: '{' },
  [UiohookKey.BracketRight]: { normal: ']', shift: '}' },
  [UiohookKey.Backslash]: { normal: '\\', shift: '|' },
  [UiohookKey.Semicolon]: { normal: ';', shift: ':' },
  [UiohookKey.Quote]: { normal: "'", shift: '"' },
  [UiohookKey.Backquote]: { normal: '`', shift: '~' },
  [UiohookKey.Comma]: { normal: ',', shift: '<' },
  [UiohookKey.Period]: { normal: '.', shift: '>' },
  [UiohookKey.Slash]: { normal: '/', shift: '?' },
};

/**
 * Maps a uiohook keyboard event to an Inkwell token or printable character.
 */
export function mapKeyEventToToken(
  e: UiohookKeyboardEvent,
  modifiers: ModifierState
): string | null {
  const { keycode } = e;
  const isShift = modifiers.shift;
  const isCmd = modifiers.meta;
  const isAlt = modifiers.alt;

  // 1. Command Combos
  if (isCmd) {
    if (keycode === UiohookKey.A) return '[⌘A]';
    if (keycode === UiohookKey.Z) return '[⌘Z]';
    if (keycode === UiohookKey.Backspace) return '[⌘⌫]';
    // If other cmd combos (e.g. Cmd+C, Cmd+V), do not log printable letters as normal typing
    return null;
  }

  // 2. Option / Alt Combos
  if (isAlt) {
    if (keycode === UiohookKey.Backspace) return '[⌥⌫]';
    // Ignore other option shortcuts or allow special character typing if needed
  }

  // 3. Navigation and Selection
  if (keycode === UiohookKey.ArrowLeft) {
    return isShift ? '[⇧←]' : '[←]';
  }
  if (keycode === UiohookKey.ArrowRight) {
    return isShift ? '[⇧→]' : '[→]';
  }
  if (keycode === UiohookKey.ArrowUp) {
    return '[↑]';
  }
  if (keycode === UiohookKey.ArrowDown) {
    return '[↓]';
  }

  // 4. Control Characters
  if (keycode === UiohookKey.Backspace) {
    return '[⌫]';
  }
  if (keycode === UiohookKey.Delete) {
    return '[⌦]';
  }
  if (keycode === UiohookKey.Enter || keycode === UiohookKey.NumpadEnter) {
    return '[↵]';
  }
  if (keycode === UiohookKey.Tab) {
    return '[⇥]';
  }

  // 5. Printable Characters
  const mapping = KEY_CHAR_MAP[keycode];
  if (mapping) {
    return isShift ? mapping.shift : mapping.normal;
  }

  return null;
}
