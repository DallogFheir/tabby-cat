import Alpine from "alpinejs";
import type { Maybe } from "../models/Maybe";
import type { TabGroup } from "../models/Tabs";
import type { TabGroupAction } from "../models/Popup";
import type { AlpineTabGroupsData } from "../models/Alpine";

Alpine.data(
  "tabGroups",
  () =>
    ({
      tabGroups: [],

      async init() {
        const tabGroups = (await browser.storage.local.get("tabGroups"))
          .tabGroups;

        if (tabGroups !== undefined) {
          this.tabGroups = JSON.parse(tabGroups as string) as TabGroup[];
        }
      },

      async showHideGroup(
        groupId: number,
        action: TabGroupAction
      ): Promise<void> {
        let func: (tabIds: number | number[]) => Promise<void | number[]>;
        switch (action) {
          case "HIDE": {
            func = browser.tabs.hide;
            break;
          }
          case "SHOW": {
            func = browser.tabs.show;
            break;
          }
          default: {
            throw new Error(`Unknown action: ${action}.`);
          }
        }

        const tabGroupsJson = (await browser.storage.local.get("tabGroups"))
          .tabGroups as Maybe<string>;

        if (tabGroupsJson) {
          const tabGroups = JSON.parse(tabGroupsJson) as TabGroup[];
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (tabGroup) {
            const tabsInGroup = await Promise.all(
              tabGroup.tabIds.map(
                async (tabId) => await browser.tabs.get(tabId)
              )
            );
            const activeTab = tabsInGroup.find((tab) => tab.active);
            if (action === "HIDE" && activeTab !== undefined) {
              const allTabs = await browser.tabs.query({});

              const activeTabIdx = activeTab.index;
              let finalIdx;
              let addend = 1;
              while (
                (allTabs[(finalIdx = activeTabIdx + addend)]?.hidden ?? true) &&
                (allTabs[(finalIdx = activeTabIdx - addend)]?.hidden ?? true)
              ) {
                addend++;
              }

              const nextOrPreviousTab = allTabs[finalIdx];
              await browser.tabs.update(activeTab.id, { active: false });
              await browser.tabs.update(nextOrPreviousTab.id, { active: true });
            }

            await func(tabGroup.tabIds);
            tabGroup.hidden = action === "HIDE";
            browser.storage.local.set({
              tabGroups: JSON.stringify(tabGroups),
            });

            const updateEvent = new CustomEvent("x-tabbycat-update", {
              detail: {
                tabGroups,
              },
            });
            document.body.dispatchEvent(updateEvent);
          }
        }
      },

      async closeGroup(groupId: number): Promise<void> {
        const tabGroupsJson = (await browser.storage.local.get("tabGroups"))
          .tabGroups as Maybe<string>;

        if (tabGroupsJson) {
          const tabGroups = JSON.parse(tabGroupsJson) as TabGroup[];
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (tabGroup) {
            await browser.tabs.remove(tabGroup.tabIds);

            const newTabGroups = tabGroups.filter(
              (oldTabGroup) => oldTabGroup !== tabGroup
            );
            await browser.storage.local.set({
              tabGroups: JSON.stringify(newTabGroups),
            });

            const updateEvent = new CustomEvent("x-tabbycat-update", {
              detail: {
                tabGroups: newTabGroups,
              },
            });
            document.body.dispatchEvent(updateEvent);
          }
        }
      },

      async getTabTitle(tabId: number): Promise<string> {
        const tab = await browser.tabs.get(tabId);
        const title = tab.title;

        if (title === undefined) {
          return "New tab";
        }

        const dots = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪"];
        return dots.some((dot) => title.startsWith(dot))
          ? title.slice(2)
          : dots.some((dot) => title.endsWith(dot))
          ? title.slice(0, -2)
          : title;
      },
    }) satisfies AlpineTabGroupsData
);

Alpine.start();
