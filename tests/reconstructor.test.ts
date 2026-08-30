import { describe, it, expect } from 'vitest';
import { reconstructText } from '../src/main/sync/reconstructor';

describe('reconstructText', () => {
  it('reconstructs plain typed characters', () => {
    const tokens = ['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd'];
    expect(reconstructText(tokens)).toBe('hello world');
  });

  it('preserves spaces between words (regression check)', () => {
    const tokens = ['f', 'o', 'o', ' ', 'b', 'a', 'r', ' ', 'b', 'a', 'z'];
    expect(reconstructText(tokens)).toBe('foo bar baz');
  });

  it('handles backspace [⌫] deleting the previous character', () => {
    const tokens = ['a', 'b', 'c', '[⌫]', 'd'];
    expect(reconstructText(tokens)).toBe('abd');
  });

  it('handles forward delete [⌦]', () => {
    const tokens = ['a', 'b', 'c', '[←]', '[←]', '[⌦]'];
    expect(reconstructText(tokens)).toBe('ac');
  });

  it('handles newline token [↵] inserting newline', () => {
    const tokens = ['l', 'i', 'n', 'e', '1', '[↵]', 'l', 'i', 'n', 'e', '2'];
    expect(reconstructText(tokens)).toBe('line1\nline2');
  });

  it('handles tab token [⇥] inserting tab', () => {
    const tokens = ['c', 'o', 'd', 'e', ':', '[↵]', '[⇥]', 'x'];
    expect(reconstructText(tokens)).toBe('code:\n\tx');
  });

  it('handles select-all [⌘A] then type replacing the whole buffer', () => {
    const tokens = ['h', 'e', 'l', 'l', 'o', '[⌘A]', 'w', 'o', 'r', 'l', 'd'];
    expect(reconstructText(tokens)).toBe('world');
  });

  it('handles Option+Backspace [⌥⌫] deleting the whole previous word', () => {
    const tokens = ['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd', '[⌥⌫]', 't', 'h', 'e', 'r', 'e'];
    expect(reconstructText(tokens)).toBe('hello there');
  });

  it('handles Cmd+Backspace [⌘⌫] deleting back to the start of the current line only', () => {
    const tokens = [
      'f', 'i', 'r', 's', 't', ' ', 'l', 'i', 'n', 'e', '[↵]',
      's', 'e', 'c', 'o', 'n', 'd', ' ', 'l', 'i', 'n', 'e',
      '[⌘⌫]',
      'n', 'e', 'w',
    ];
    expect(reconstructText(tokens)).toBe('first line\nnew');
  });

  it('handles Shift+Arrow ([⇧←], [⇧→]) selection replaced by the next typed character', () => {
    const tokens = ['t', 'e', 's', 't', '[⇧←]', '[⇧←]', 'x'];
    expect(reconstructText(tokens)).toBe('tex');
  });

  it('treats undo [⌘Z] as a no-op', () => {
    const tokens = ['a', 'b', 'c', '[⌘Z]', 'd'];
    expect(reconstructText(tokens)).toBe('abcd');
  });

  it('ignores unknown bracketed tokens gracefully', () => {
    const tokens = ['a', '[F1]', '[UnknownToken]', 'b'];
    expect(reconstructText(tokens)).toBe('ab');
  });
});
