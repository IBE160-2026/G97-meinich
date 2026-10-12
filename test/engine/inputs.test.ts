import { describe, expect, it } from 'vitest';
import { apiInputsFromRow, parseDecimal, parseOre } from '../../src/engine/inputs.ts';

describe('parseOre', () => {
  it('parses a bigint string exactly, above 2^53', () => {
    expect(parseOre('9007199254740993')).toBe(9007199254740993n);
    expect(parseOre('-1776700')).toBe(-1776700n);
  });

  it('passes null through', () => {
    expect(parseOre(null)).toBeNull();
  });

  it.each(['1.5', '1e3', '', ' 1', '+1', '0x10'])('refuses %j', (value) => {
    expect(() => parseOre(value)).toThrow(TypeError);
  });

  it('refuses a number', () => {
    expect(() => parseOre(1000 as unknown as string)).toThrow(TypeError);
  });
});

describe('parseDecimal', () => {
  it('parses a numeric string exactly', () => {
    expect(parseDecimal('1.5')?.toString()).toBe('1.5');
    expect(parseDecimal('12.345')?.toString()).toBe('12.345');
    expect(parseDecimal('9007199254740993')?.toString()).toBe('9007199254740993');
  });

  it('passes null through', () => {
    expect(parseDecimal(null)).toBeNull();
  });

  it.each(['1e3', '1.', '.5', 'NaN', 'Infinity', '1,5'])('refuses %j', (value) => {
    expect(() => parseDecimal(value)).toThrow(TypeError);
  });

  it('refuses a number', () => {
    expect(() => parseDecimal(1.5 as unknown as string)).toThrow(TypeError);
  });
});

describe('apiInputsFromRow', () => {
  it('reads the register.key_figures column names', () => {
    expect(
      apiInputsFromRow({
        sum_driftsinntekter_ore: null,
        driftsresultat_ore: '-1700300',
        sum_driftskostnad_ore: '1700400',
        sum_eiendeler_ore: '19677900',
        sum_egenkapital_gjeld_ore: '19677900',
        sum_egenkapital_ore: null,
        sum_gjeld_ore: '3032700',
      }),
    ).toEqual({
      sumDriftsinntekter: null,
      driftsresultat: -1700300n,
      sumDriftskostnad: 1700400n,
      sumEiendeler: 19677900n,
      sumEgenkapitalGjeld: 19677900n,
      sumEgenkapital: null,
      sumGjeld: 3032700n,
    });
  });
});
