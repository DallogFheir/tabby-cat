import type { Favicon, FaviconData } from "./models/Favicon";
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

  async #getTabGroups(): Promise<Maybe<TabGroup[]>> {
    const tabGroups = (await browser.storage.local.get("tabGroups")).tabGroups;

    return tabGroups ? JSON.parse(tabGroups as string) : null;
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
        id: `group-${group.groupId}`,
        title: group.groupName,
        type: "radio",
        checked:
          group.tabIds.find((tabInGroupId) => tabInGroupId === tab.id) !==
          undefined,
        contexts: ["tab"],
      });
    });

    browser.menus.create({
      id: "separator",
      type: "separator",
      contexts: ["tab"],
    });

    browser.menus.create({
      id: "new-group",
      title: "New group...",
      contexts: ["tab"],
    });

    browser.menus.refresh();
  }

  async #handleMenuClick(
    info: browser.menus.OnClickData,
    tab: browser.tabs.Tab
  ): Promise<void> {
    const newGroupId = Number(
      String(info.menuItemId).match(/^group-(\d+)$/)?.[1] ?? NaN
    );
    const tabId = tab.id;
    const tabGroups = await this.#getTabGroups();

    const oldGroup = tabGroups?.find((tabGroup) =>
      (tabGroup.tabIds as (number | undefined)[]).includes(tabId)
    );
    const newGroup = tabGroups?.find(
      (tabGroup) => tabGroup.groupId === newGroupId
    );

    if (
      newGroupId &&
      tabGroups &&
      tabId !== undefined &&
      oldGroup &&
      newGroup
    ) {
      oldGroup.tabIds = oldGroup.tabIds.filter(
        (tabInGroupId) => tabInGroupId !== tabId
      );

      newGroup.tabIds.push(tabId);

      browser.storage.local.set({
        tabGroups: JSON.stringify(tabGroups),
      });
    }
  }

  #initContextMenuListener(): void {
    browser.menus.onShown.addListener(this.#updateMenu);
    browser.menus.onClicked.addListener(this.#handleMenuClick.bind(this));
  }

  async #changeFavicon(tabId: number, iconUrl: Maybe<string>): Promise<void> {
    let favicon: Maybe<Favicon> = null;

    if (iconUrl?.includes("x-tabby-cat=true")) {
      return;
    }

    if (iconUrl) {
      const resp = await fetch(iconUrl);
      if (resp.headers.get("content-type") === "image/svg+xml") {
        favicon = await resp.text();
      } else {
        favicon = await resp.blob();
      }
    }

    browser.tabs.sendMessage(tabId, {
      favicon,
      color: "#ff0000", // #TODO: take color from group
    } satisfies FaviconData);
  }

  async #updateGroupTitle(tabId: number, title: string): Promise<void> {
    const tabGroups = await this.#getTabGroups();

    if (tabGroups) {
      outer: for (const tabGroup of tabGroups) {
        if (tabGroup.updatesToGo !== 0) {
          for (const tabInGroupId of tabGroup.tabIds) {
            if (tabInGroupId === tabId) {
              tabGroup.updatesToGo--;

              if (tabGroup.updatesToGo === 0) {
                tabGroup.groupName = title;
              }

              break outer;
            }
          }
        }
      }

      browser.storage.local.set({
        tabGroups: JSON.stringify(tabGroups),
      });
    }
  }

  async #tabListener(
    tabOrTabId: browser.tabs.Tab | number,
    tabAction: TabAction
  ): Promise<void> {
    const tabGroups = await this.#getTabGroups();

    if (tabGroups) {
      let res: Maybe<TabGroup[]> = null;

      switch (tabAction) {
        case "ADD": {
          const tab = tabOrTabId as browser.tabs.Tab;
          const tabId = tab.id;

          if (tabId !== undefined) {
            let freeId = 1;
            tabGroups
              .sort((a, b) => a.groupId - b.groupId)
              .every((group) => {
                if (group.groupId === freeId) {
                  freeId++;
                  return true;
                }

                return false;
              });

            res = tabGroups.concat([
              {
                groupId: freeId,
                groupName: tab?.title ?? "New group",
                tabIds: [tabId],
                updatesToGo: tab.url === "about:newtab" ? 2 : 1,
              },
            ]);
          }
          break;
        }
        case "REMOVE": {
          const tabId = tabOrTabId as number;

          res = tabGroups
            .map((tabGroup) => ({
              ...tabGroup,
              tabs: tabGroup.tabIds.filter(
                (tabInGroupId) => tabInGroupId !== tabId
              ),
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
    let groupId = 1;
    const tabGroups: TabGroup[] = tabs
      .filter((tab) => tab.id !== undefined)
      .map((tab) => {
        return {
          groupId: groupId++,
          groupName: tab?.title ?? "New group",
          tabIds: [tab.id!],
          updatesToGo: 0,
        };
      });

    await browser.storage.local.set({ tabGroups: JSON.stringify(tabGroups) });

    browser.tabs.onCreated.addListener((tab) => this.#tabListener(tab, "ADD"));
    browser.tabs.onUpdated.addListener(
      (tabId, { favIconUrl, title }) => {
        if (favIconUrl !== undefined) {
          this.#changeFavicon(tabId, favIconUrl);
        }
        if (title) {
          this.#updateGroupTitle(tabId, title);
        }
      },
      /* eslint-disable-next-line */
      /* @ts-ignore */
      {
        properties: ["favIconUrl", "title"],
      }
    );
    browser.tabs.onRemoved.addListener((tabId) =>
      this.#tabListener(tabId, "REMOVE")
    );
  }
}

browser.runtime.onInstalled.addListener(TabbyCat.initialize);
browser.runtime.onStartup.addListener(TabbyCat.initialize);
