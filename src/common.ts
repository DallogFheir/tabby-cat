import type { Maybe } from "./models/Maybe";
import type { Options } from "./models/Options";
import {
  colorsToDots,
  type ContentScriptMessage,
  type TabGroup,
} from "./models/Tabs";

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

    if (tabGroup === undefined) {
      return;
    }

    const tab = await browser.tabs.get(tabId);
    const title = tab.title;

    if (title === undefined) {
      return;
    }

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

    browser.tabs.sendMessage(tabId, {
      changeAction: "TITLE",
      msg: newTitle,
    } satisfies ContentScriptMessage);
  }
};

export const updateTabFavicon = async (tabId: number): Promise<void> => {
  const options = await getOptions();
  const tabGroups = await getTabGroups();

  if (tabGroups && options) {
    const tabGroup = tabGroups.find((group) =>
      group.tabs.map(({ id }) => id).includes(tabId)
    );

    if (tabGroup === undefined) {
      return;
    }

    const tab = await browser.tabs.get(tabId);
    const faviconUrl = tab.favIconUrl;

    if (faviconUrl === undefined || faviconUrl.includes("x-tabby-cat")) {
      return;
    }

    let dataUrl: Maybe<string>;
    if (faviconUrl.startsWith("data:")) {
      dataUrl = faviconUrl;
    } else {
      const faviconResp = await fetch(faviconUrl);
      const faviconBlob = await faviconResp.blob();
      const faviconBitmap = await createImageBitmap(faviconBlob);

      const canvas = document.createElement("canvas");
      canvas.height = faviconBitmap.height;
      canvas.width = faviconBitmap.width;
      const ctx = canvas.getContext("2d");

      if (ctx === null) {
        return;
      }

      ctx.drawImage(faviconBitmap, 0, 0);
      dataUrl = canvas.toDataURL();
    }

    const [firstPart, ...rest] = dataUrl.split(";");
    const newDataUrl = `${firstPart};x-tabby-cat=${tabGroup.color.slice(
      1
    )};${rest.join(";")}`;

    browser.tabs.sendMessage(tabId, {
      changeAction: "FAVICON",
      msg: newDataUrl,
    } satisfies ContentScriptMessage);
  }
};

export const getFreeId = (tabGroups: TabGroup[]): number => {
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

  return freeId;
};
