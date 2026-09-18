// European roulette constants — ported 1:1 from Avlo's lib/constants.ts so the
// wheel, board and colours match the reference exactly.
export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// European wheel pocket order (clockwise from 0).
export const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const BET_TYPES = {
  NUMBER: 0, RED: 1, BLACK: 2, EVEN: 3, ODD: 4, LOW: 5, HIGH: 6,
  DOZEN1: 7, DOZEN2: 8, DOZEN3: 9, COL1: 10, COL2: 11, COL3: 12,
} as const;

export const BET_TYPE_LABELS: Record<number, string> = {
  0: "Number", 1: "Red", 2: "Black", 3: "Even", 4: "Odd", 5: "Low (1-18)", 6: "High (19-36)",
  7: "1st Dozen", 8: "2nd Dozen", 9: "3rd Dozen", 10: "Col 1", 11: "Col 2", 12: "Col 3",
};

export function getNumberColor(num: number): "red" | "black" | "green" {
  if (num === 0) return "green";
  if (RED_NUMBERS.includes(num)) return "red";
  return "black";
}
