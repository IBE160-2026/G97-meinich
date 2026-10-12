export const kroner = (value: number): string => new Intl.NumberFormat('nb-NO').format(value);
