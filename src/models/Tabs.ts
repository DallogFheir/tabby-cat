export interface TabGroup {
  tabs: browser.tabs.Tab[];
  groupName: string;
}

export type TabAction = "ADD" | "REMOVE";
