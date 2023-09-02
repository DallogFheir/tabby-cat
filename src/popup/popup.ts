import Alpine from "alpinejs";
import type { Maybe } from "../models/Maybe";
import type { TabGroup } from "../models/Tabs";
import type { TabGroupAction, ActionIcon } from "../models/Popup";
import type { AlpineTabGroupsData } from "../models/Alpine";
import type { Options } from "../models/Options";

Alpine.data(
  "tabGroups",
  () =>
    ({
      currentTabId: null,
      tabGroups: [],

      async init() {
        const tabGroups = (await browser.storage.sync.get("tabGroups"))
          .tabGroups;
        if (tabGroups !== undefined) {
          this.tabGroups = JSON.parse(tabGroups as string) as TabGroup[];
        }

        const activeTabs = await browser.tabs.query({ active: true });
        this.currentTabId = activeTabs[0].id ?? null;
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

        const tabGroupsJson = (await browser.storage.sync.get("tabGroups"))
          .tabGroups as Maybe<string>;

        if (tabGroupsJson) {
          const tabGroups = JSON.parse(tabGroupsJson) as TabGroup[];
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (tabGroup) {
            const tabsInGroup = await Promise.all(
              tabGroup.tabs.map(async ({ id }) => await browser.tabs.get(id))
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

            await func(tabGroup.tabs.map(({ id }) => id));
            tabGroup.hidden = action === "HIDE";
            browser.storage.sync.set({
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
        const tabGroupsJson = (await browser.storage.sync.get("tabGroups"))
          .tabGroups as Maybe<string>;
        const optionsJson = (await browser.storage.sync.get("options"))
          .options as Maybe<string>;

        if (tabGroupsJson && optionsJson) {
          const tabGroups = JSON.parse(tabGroupsJson) as TabGroup[];
          const options = JSON.parse(optionsJson) as Options;

          if (options.removeEmptyGroups) {
            await this.removeGroup(groupId);
          } else {
            const tabGroup = tabGroups.find(
              (tabGroup) => tabGroup.groupId === groupId
            );

            if (tabGroup) {
              await browser.tabs.remove(tabGroup.tabs.map(({ id }) => id));

              tabGroup.tabs = [];

              await browser.storage.sync.set({
                tabGroups: JSON.stringify(tabGroups),
              });

              const updateEvent = new CustomEvent("x-tabbycat-update", {
                detail: {
                  tabGroups: tabGroups,
                },
              });
              document.body.dispatchEvent(updateEvent);
            }
          }
        }
      },

      async removeGroup(groupId: number): Promise<void> {
        const tabGroupsJson = (await browser.storage.sync.get("tabGroups"))
          .tabGroups as Maybe<string>;

        if (tabGroupsJson) {
          const tabGroups = JSON.parse(tabGroupsJson) as TabGroup[];
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (tabGroup) {
            await browser.tabs.remove(tabGroup.tabs.map(({ id }) => id));

            const newTabGroups = tabGroups.filter(
              (oldTabGroup) => oldTabGroup !== tabGroup
            );
            await browser.storage.sync.set({
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

      async removeAllGroups(): Promise<void> {
        const tabGroupsJson = (await browser.storage.sync.get("tabGroups"))
          .tabGroups as Maybe<string>;

        if (tabGroupsJson) {
          const tabGroups = JSON.parse(tabGroupsJson) as TabGroup[];
          const tabIds = tabGroups.reduce((tabIdsAcc, tabGroup) => {
            tabIdsAcc.push(...tabGroup.tabs.map(({ id }) => id));
            return tabIdsAcc;
          }, [] as number[]);

          await browser.tabs.remove(tabIds);

          await browser.storage.sync.set({
            tabGroups: JSON.stringify([]),
          });

          const updateEvent = new CustomEvent("x-tabbycat-update", {
            detail: {
              tabGroups: [],
            },
          });
          document.body.dispatchEvent(updateEvent);
        }
      },

      async openTabInGroup(groupId: number): Promise<void> {
        const tab = await browser.tabs.create({});
        const tabGroupsJson = (await browser.storage.sync.get("tabGroups"))
          .tabGroups as Maybe<string>;

        if (tabGroupsJson && tab.id !== undefined) {
          const tabGroups = JSON.parse(tabGroupsJson) as TabGroup[];
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (tabGroup) {
            tabGroup.tabs.push({ id: tab.id, url: tab.url ?? "New Tab" });

            await browser.storage.sync.set({
              tabGroups: JSON.stringify(tabGroups),
            });
          }
        }
      },

      async peekTab(tabId: number): Promise<void> {
        await browser.tabs.update(tabId, { active: true });
      },

      async stopPeek(): Promise<void> {
        if (this.currentTabId !== null) {
          await browser.tabs.update(this.currentTabId, { active: true });
        }
      },

      async goToTab(tabId: number): Promise<void> {
        this.currentTabId = tabId;
        await this.peekTab(tabId);
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

      async getTabFavicon(tabId: number): Promise<Maybe<string>> {
        const tab = await browser.tabs.get(tabId);
        return tab.favIconUrl;
      },

      async shouldIconBeDisabled(
        icon: ActionIcon,
        tabCount: number
      ): Promise<boolean> {
        if (tabCount === 0) {
          return true;
        }

        if (icon === "HIDE") {
          const visibleTabsCount = (await browser.tabs.query({ hidden: false }))
            .length;

          if (visibleTabsCount === 1) {
            return true;
          }
        }

        return false;
      },
    }) satisfies AlpineTabGroupsData
);

Alpine.start();
