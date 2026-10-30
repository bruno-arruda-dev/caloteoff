import { describe, it, expect } from 'vitest';
import { getLimitColors } from '../src/utils/limit';

describe('Limit Progress Circle Color Logic', () => {
  it('returns green for low consumption (under 20%)', () => {
    const res = getLimitColors(15);
    expect(res.status).toBe('seguro');
    expect(res.border).toBe('#10B981');
  });

  it('returns yellow for medium consumption (50%)', () => {
    const res = getLimitColors(50);
    expect(res.status).toBe('medio');
    expect(res.border).toBe('#EAB308');
  });

  it('returns red for critical consumption (90%)', () => {
    const res = getLimitColors(90);
    expect(res.status).toBe('critico');
    expect(res.border).toBe('#EF4444');
  });

  it('returns intense dark red for exceeded limit (>100%)', () => {
    const res = getLimitColors(120);
    expect(res.status).toBe('estourado');
    expect(res.border).toBe('#DC2626');
  });
});
