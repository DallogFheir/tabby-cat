export const colorsToDots = {
  "#e81224": "🔴",
  "#f7630c": "🟠",
  "#fff100": "🟡",
  "#16c60c": "🟢",
  "#0078d7": "🔵",
  "#886ce4": "🟣",
  "#8e562e": "🟤",
  "#000000": "⚫",
  "#f2f2f2": "⚪",
} as const;

export type Color = keyof typeof colorsToDots;

export interface Tab {
  id: number;
  url: string;
}

export type UpdateToGo = 0 | 1 | 2;

export interface TabGroup {
  groupId: number;
  groupName: string;
  color: Color;
  hidden: boolean;
  tabs: Tab[];
  updatesToGo: UpdateToGo;
}

export type TabAction = "ADD" | "REMOVE";
