import type { Maybe } from "./models/Maybe";
import type { Options, OptionsChange } from "./models/Options";
import {
  colorsToDots,
  type Color,
  type TabAction,
  type TabGroup,
} from "./models/Tabs";

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
    this.#initOptions();
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

  async #getOptions(): Promise<Maybe<Options>> {
    const options = (await browser.storage.local.get("options")).options;

    return options ? JSON.parse(options as string) : null;
  }

  async #saveTabGroups(tabGroups: TabGroup[]): Promise<void> {
    await browser.storage.local.set({
      tabGroups: JSON.stringify(tabGroups),
    });
  }

  #getColor(currentColors: Color[]): Color {
    const colors = Object.keys(colorsToDots) as (keyof typeof colorsToDots)[];
    let colorsToPick: Readonly<Color[]> = colors.filter(
      (color) => !currentColors.includes(color)
    );
    if (colorsToPick.length === 0) {
      colorsToPick = colors;
    }

    return colorsToPick[Math.floor(Math.random() * colorsToPick.length)];
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

    if (tab.url !== undefined && !tab.url?.startsWith("about:")) {
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
    }

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

      await this.#saveTabGroups(tabGroups);
    }
  }

  #initContextMenuListener(): void {
    browser.menus.onShown.addListener(this.#updateMenu);
    browser.menus.onClicked.addListener(this.#handleMenuClick.bind(this));
  }

  async #updateGroupName(tabId: number, title: string): Promise<void> {
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
    }
  }

  async #updateTabTitle(tabId: number): Promise<void> {
    const options = await this.#getOptions();
    const tabGroups = await this.#getTabGroups();

    if (tabGroups && options) {
      const tabGroup = tabGroups.find((group) => group.tabIds.includes(tabId));
      const tab = await browser.tabs.get(tabId);
      const title = tab.title;

      if (tabGroup && title) {
        const dot = colorsToDots[tabGroup.color];
        const startsWithDot = Object.values(colorsToDots).some((dot) =>
          title.startsWith(dot)
        );
        const endsWithDot = Object.values(colorsToDots).some((dot) =>
          title.endsWith(dot)
        );

        const titleWithoutDot = startsWithDot
          ? title.slice(2)
          : endsWithDot
          ? title.slice(0, -2)
          : title;

        let newTitle: string;
        switch (options.colorIndicator) {
          case "off": {
            newTitle = titleWithoutDot;
            break;
          }
          case "begin": {
            newTitle = `${dot} ${titleWithoutDot}`;
            break;
          }
          case "end": {
            newTitle = `${titleWithoutDot} ${dot}`;
            break;
          }
        }

        browser.tabs.sendMessage(tabId, newTitle);
      }
    }
  }

  async #updateAllTabsTitles(): Promise<void> {
    const tabs = await browser.tabs.query({});
    const updateTitlesPromises = tabs
      .filter((tab) => tab.id !== undefined)
      .map(({ id }) => this.#updateTabTitle(id as number));
    await Promise.all(updateTitlesPromises);
  }

  async #createNewGroup(tabId: number): Promise<void> {
    const tabGroups = await this.#getTabGroups();
    const tab = await browser.tabs.get(tabId);

    if (
      tabGroups &&
      tabGroups.every((tabGroup) => !tabGroup.tabIds.includes(tabId))
    ) {
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

      const res = tabGroups.concat([
        {
          groupId: freeId,
          groupName: tab?.title ?? "New group",
          color: this.#getColor(tabGroups.map((tabGroup) => tabGroup.color)),
          hidden: false,
          tabIds: [tabId],
          updatesToGo: tab.url === "about:newtab" ? 2 : 1,
        },
      ]);

      await this.#saveTabGroups(res);

      await this.#updateTabTitle(tabId);
    }
  }

  async #addToGroup(tabId: number, openerTabId: number): Promise<void> {
    const tabGroups = await this.#getTabGroups();
    const openerTabGroup = tabGroups?.find((tabGroup) =>
      tabGroup.tabIds.includes(openerTabId)
    );

    if (
      tabGroups &&
      tabGroups.every((tabGroup) => !tabGroup.tabIds.includes(tabId)) &&
      openerTabGroup
    ) {
      openerTabGroup.tabIds.push(tabId);
      await this.#saveTabGroups(tabGroups);
    }
  }

  async #tabListener(
    tabOrTabId: browser.tabs.Tab | number,
    tabAction: TabAction
  ): Promise<void> {
    const tabGroups = await this.#getTabGroups();

    if (tabGroups) {
      switch (tabAction) {
        case "ADD": {
          const tab = tabOrTabId as browser.tabs.Tab;

          if (!tab.url || tab.url.startsWith("about:")) {
            return;
          }

          const tabId = tab.id;
          if (tabId) {
            if (tab.openerTabId === undefined) {
              await this.#createNewGroup(tabId);
            } else {
              await this.#addToGroup(tabId, tab.openerTabId);
            }
          }
          break;
        }
        case "REMOVE": {
          const tabId = tabOrTabId as number;

          const res = tabGroups
            .map((tabGroup) => ({
              ...tabGroup,
              tabs: tabGroup.tabIds.filter(
                (tabInGroupId) => tabInGroupId !== tabId
              ),
            }))
            .filter((tabGroup) => tabGroup.tabs.length > 0);

          await this.#saveTabGroups(res);

          break;
        }
        default: {
          throw new Error(`Invalid tab action: ${tabAction}.`);
        }
      }
    }
  }

  async #initTabListener(): Promise<void> {
    const tabs = await browser.tabs.query({});
    let groupId = 1;
    const colors: Color[] = [];
    const tabGroups: TabGroup[] = tabs
      .filter((tab) => tab.id !== undefined && !tab.url?.startsWith("about:"))
      .map((tab) => {
        const color = this.#getColor(colors);
        colors.push(color);

        return {
          groupId: groupId++,
          groupName: tab?.title ?? "New group",
          color,
          hidden: false,
          tabIds: [tab.id!],
          updatesToGo: 0,
        };
      });

    await this.#saveTabGroups(tabGroups);
    await this.#updateAllTabsTitles();

    browser.tabs.onCreated.addListener((tab) => this.#tabListener(tab, "ADD"));
    browser.tabs.onUpdated.addListener(
      async (tabId) => {
        const { status, title, url } = await browser.tabs.get(tabId);

        if (status === "complete" && url && !url.startsWith("about:")) {
          const tab = await browser.tabs.get(tabId);
          const tabGroups = await this.#getTabGroups();

          if (
            tabGroups?.every((tabGroup) => !tabGroup.tabIds.includes(tabId))
          ) {
            if (tab.openerTabId === undefined) {
              await this.#createNewGroup(tabId);
            } else {
              await this.#addToGroup(tabId, tab.openerTabId);
            }
          }
        }
        if (
          status === "complete" &&
          title &&
          Object.values(colorsToDots).every((dot) => !title.startsWith(dot))
        ) {
          await this.#updateGroupName(tabId, title);
          await this.#updateTabTitle(tabId);
        }
      },
      /* eslint-disable-next-line */
      /* @ts-ignore */
      {
        properties: ["status", "title", "url"],
      }
    );
    browser.tabs.onRemoved.addListener((tabId) =>
      this.#tabListener(tabId, "REMOVE")
    );
  }

  async #initOptions(): Promise<void> {
    await browser.storage.local.set({
      options: JSON.stringify({ colorIndicator: "begin" } satisfies Options),
    });

    /* eslint-disable-next-line */
    /* @ts-ignore */
    browser.storage.local.onChanged.addListener((changes: OptionsChange) => {
      const options = changes.options;

      if (options !== undefined) {
        this.#updateAllTabsTitles();
      }
    });
  }
}

browser.runtime.onInstalled.addListener(TabbyCat.initialize);
browser.runtime.onStartup.addListener(TabbyCat.initialize);
