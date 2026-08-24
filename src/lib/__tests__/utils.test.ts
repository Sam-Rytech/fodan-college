import { describe, it, expect } from 'vitest';
import { slugify, initials, formatPercent, formatBytes } from '../utils';

describe('utils - slugify', () => {
  it('should format simple strings', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('should strip special characters', () => {
    expect(slugify('Fodan College: 2024!')).toBe('fodan-college-2024');
  });

  it('should handle accents', () => {
    expect(slugify('Café au Lait')).toBe('cafe-au-lait');
  });
});

describe('utils - initials', () => {
  it('should return initials for two names', () => {
    expect(initials('John Doe')).toBe('JD');
  });

  it('should return initials for three names', () => {
    expect(initials('John Jacob Smith')).toBe('JS');
  });

  it('should handle single names', () => {
    expect(initials('Admin')).toBe('AD');
  });
});

describe('utils - formatPercent', () => {
  it('should format integer percentages', () => {
    expect(formatPercent(50)).toBe('50%');
  });

  it('should format decimal percentages to 1 digit', () => {
    expect(formatPercent(33.333)).toBe('33.3%');
  });
});

describe('utils - formatBytes', () => {
  it('should format bytes appropriately', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });
});
