export const colorsToDots = {
  "#e81224": "🔴",
  "#f7630c": "🟠",
  "#fff100": "🟡",
  "#16c60c": "🟢",
  "#0078d7": "🔵",
  "#886ce4": "🟣",
  "#8e562e": "🟤",
  "#383838": "⚫",
  "#f2f2f2": "⚪",
} as const;

export type Color = keyof typeof colorsToDots;

export interface TabGroup {
  groupId: number;
  groupName: string;
  color: Color;
  hidden: boolean;
  tabIds: number[];
  updatesToGo: 0 | 1 | 2;
}

export type TabAction = "ADD" | "REMOVE";
