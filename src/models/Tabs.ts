export interface TabGroup {
  groupId: number;
  groupName: string;
  tabIds: number[];
  updatesToGo: 0 | 1 | 2;
}

export type TabAction = "ADD" | "REMOVE";
