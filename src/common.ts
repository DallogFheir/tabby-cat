import type { Maybe } from "./models/Maybe";
import type { Options } from "./models/Options";
import { colorsToDots, type TabGroup } from "./models/Tabs";

export const getTabGroups = async (): Promise<Maybe<TabGroup[]>> => {
  const tabGroups = (await browser.storage.sync.get("tabGroups")).tabGroups;

  return tabGroups ? JSON.parse(tabGroups as string) : null;
};

export const getOptions = async (): Promise<Maybe<Options>> => {
  const options = (await browser.storage.sync.get("options")).options;

  return options ? JSON.parse(options as string) : null;
};

export const updateTabTitle = async (tabId: number): Promise<void> => {
  const options = await getOptions();
  const tabGroups = await getTabGroups();

  if (tabGroups && options) {
    const tabGroup = tabGroups.find((group) =>
      group.tabs.map(({ id }) => id).includes(tabId)
    );
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
};
