import type { Maybe } from "./models/Maybe";
import type { TabAction, TabGroup } from "./models/Tabs";

class TabbyCat {
  static #isInternallyConstructing = false;
  static #instance: Maybe<TabbyCat>;

  constructor() {
    if (!TabbyCat.#isInternallyConstructing) {
      throw new TypeError("Use TabbyCat.initialize() instead.");
    }

    TabbyCat.#isInternallyConstructing = false;
    this.#initContextMenuListener();
    this.#initTabListener();
  }

  static initialize(): void {
    if (!TabbyCat.#instance) {
      TabbyCat.#isInternallyConstructing = true;
      TabbyCat.#instance = new TabbyCat();
    }
  }

  async #updateMenu(
    _: browser.menus.OnClickData,
    tab: browser.tabs.Tab
  ): Promise<void> {
    const tabGroups = JSON.parse(
      ((await browser.storage.local.get("tabGroups"))
        ?.tabGroups as Maybe<string>) ?? "[]"
    ) as TabGroup[];

    browser.menus.removeAll();

    tabGroups.forEach((group) => {
      browser.menus.create({
        id: `group-${group.groupName}`,
        title: group.groupName,
        type: "radio",
        checked:
          group.tabs.find((tabInGroup) => tabInGroup.id === tab.id) !==
          undefined,
        contexts: ["tab"],
      });
    });

    browser.menus.create({
      id: "separator",
      type: "separator",
    });

    browser.menus.create({
      id: "new-group",
      title: "New group...",
      contexts: ["tab"],
    });
  }

  #initContextMenuListener(): void {
    browser.menus.onShown.addListener(this.#updateMenu);
  }

  async #tabListener(
    tabOrTabId: browser.tabs.Tab | number,
    tabAction: TabAction
  ): Promise<void> {
    const currentState = await browser.storage.local.get("tabGroups");

    if (currentState?.tabGroups) {
      const currentTabGroups = JSON.parse(
        currentState.tabGroups as string
      ) as TabGroup[];

      let res: Maybe<TabGroup[]>;
      switch (tabAction) {
        case "ADD": {
          const tab = tabOrTabId as browser.tabs.Tab;

          res = currentTabGroups.concat([
            {
              tabs: [tab],
              groupName: tab?.title ?? "New group",
            },
          ]);

          break;
        }
        case "REMOVE": {
          const tabId = tabOrTabId as number;

          res = currentTabGroups
            .map((tabGroup) => ({
              tabs: tabGroup.tabs.filter((tab) => tab?.id !== tabId),
              groupName: tabGroup.groupName,
            }))
            .filter((tabGroup) => tabGroup.tabs.length > 0);

          break;
        }
        default: {
          throw new Error(`Invalid tab action: ${tabAction}.`);
        }
      }

      browser.storage.local.set({
        tabGroups: JSON.stringify(res),
      });
    }
  }

  async #initTabListener(): Promise<void> {
    const tabs = await browser.tabs.query({});
    const tabGroups: TabGroup[] = tabs.map((tab) => ({
      tabs: [tab],
      groupName: tab?.title ?? "New group",
    }));

    await browser.storage.local.set({ tabGroups: JSON.stringify(tabGroups) });

    browser.tabs.onCreated.addListener((tab) => this.#tabListener(tab, "ADD"));
    browser.tabs.onRemoved.addListener((tabId) =>
      this.#tabListener(tabId, "REMOVE")
    );
  }
}

browser.runtime.onInstalled.addListener(TabbyCat.initialize);
browser.runtime.onStartup.addListener(TabbyCat.initialize);
