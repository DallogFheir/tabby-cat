export const colors = [
  "#FF8C6A",
  "#55A868",
  "#4287B0",
  "#E6B450",
  "#A8708C",
  "#3969AC",
  "#7D984D",
  "#7B539F",
  "#E5642A",
  "#2E9E75",
  "#00A7AF",
  "#C63F62",
  "#FBB040",
  "#2976BB",
  "#C94A1F",
  "#8A5DA3",
  "#00A553",
  "#D5336C",
  "#006BAC",
  "#FFA300",
] as const;

export type Color = (typeof colors)[number];

export interface TabGroup {
  groupId: number;
  groupName: string;
  color: Color;
  hidden: boolean;
  tabIds: number[];
  updatesToGo: 0 | 1 | 2;
}

export type TabAction = "ADD" | "REMOVE";
