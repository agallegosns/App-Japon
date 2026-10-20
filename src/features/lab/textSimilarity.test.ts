import { describe, expect, it } from 'vitest';
import { lcsRatio } from './textSimilarity';

describe('lcsRatio', () => {
  it('mide la proporción reconocida ignorando espacios', () => {
    expect(lcsRatio('東京駅 出口', '東京駅出口')).toBe(1);
    expect(lcsRatio('東京駅出口', '東京X出口')).toBeCloseTo(0.8);
    expect(lcsRatio('東京', '')).toBe(0);
  });
});
