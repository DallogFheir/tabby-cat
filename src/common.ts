import type { Maybe } from "./models/common";
import { COLOR_INDICATOR_OPTIONS, type Options } from "./models/Options";
import { colorsToDots, type TabGroup } from "./models/Tabs";
import {
  CONTENT_SCRIPT_CHANGE_ACTIONS,
  type ContentScriptMessage,
} from "./models/Commands";
import { STORAGE_KEYS } from "./constants";

export const getTabGroups = async (): Promise<Maybe<TabGroup[]>> => {
  const tabGroups = (await browser.storage.sync.get(STORAGE_KEYS.TAB_GROUPS))
    .tabGroups;

  return tabGroups ? JSON.parse(tabGroups as string) : null;
};

export const getOptions = async (): Promise<Maybe<Options>> => {
  const options = (await browser.storage.sync.get(STORAGE_KEYS.OPTIONS))
    .options;

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
      case COLOR_INDICATOR_OPTIONS.OFF: {
        newTitle = titleWithoutDot;
        break;
      }
      case COLOR_INDICATOR_OPTIONS.BEGIN: {
        newTitle = `${dot} ${titleWithoutDot}`;
        break;
      }
      case COLOR_INDICATOR_OPTIONS.END: {
        newTitle = `${titleWithoutDot} ${dot}`;
        break;
      }
    }

    browser.tabs.sendMessage(tabId, {
      changeAction: CONTENT_SCRIPT_CHANGE_ACTIONS.TITLE,
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

    let dataUrl: Maybe<string>;
    if (faviconUrl === undefined) {
      dataUrl =
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0id2hpdGUiIGNsYXNzPSJiaSBiaS1nbG9iZTIiIHZpZXdCb3g9IjAgMCAxNiAxNiI+CiAgPHBhdGggZD0iTTAgOGE4IDggMCAxIDEgMTYgMEE4IDggMCAwIDEgMCA4em03LjUtNi45MjNjLS42Ny4yMDQtMS4zMzUuODItMS44ODcgMS44NTUtLjE0My4yNjgtLjI3Ni41Ni0uMzk1Ljg3Mi43MDUuMTU3IDEuNDcyLjI1NyAyLjI4Mi4yODdWMS4wNzd6TTQuMjQ5IDMuNTM5Yy4xNDItLjM4NC4zMDQtLjc0NC40ODEtMS4wNzhhNi43IDYuNyAwIDAgMSAuNTk3LS45MzNBNy4wMSA3LjAxIDAgMCAwIDMuMDUxIDMuMDVjLjM2Mi4xODQuNzYzLjM0OSAxLjE5OC40OXpNMy41MDkgNy41Yy4wMzYtMS4wNy4xODgtMi4wODcuNDM2LTMuMDA4YTkuMTI0IDkuMTI0IDAgMCAxLTEuNTY1LS42NjdBNi45NjQgNi45NjQgMCAwIDAgMS4wMTggNy41aDIuNDl6bTEuNC0yLjc0MWExMi4zNDQgMTIuMzQ0IDAgMCAwLS40IDIuNzQxSDcuNVY1LjA5MWMtLjkxLS4wMy0xLjc4My0uMTQ1LTIuNTkxLS4zMzJ6TTguNSA1LjA5VjcuNWgyLjk5YTEyLjM0MiAxMi4zNDIgMCAwIDAtLjM5OS0yLjc0MWMtLjgwOC4xODctMS42ODEuMzAxLTIuNTkxLjMzMnpNNC41MSA4LjVjLjAzNS45ODcuMTc2IDEuOTE0LjM5OSAyLjc0MUExMy42MTIgMTMuNjEyIDAgMCAxIDcuNSAxMC45MVY4LjVINC41MXptMy45OSAwdjIuNDA5Yy45MS4wMyAxLjc4My4xNDUgMi41OTEuMzMyLjIyMy0uODI3LjM2NC0xLjc1NC40LTIuNzQxSDguNXptLTMuMjgyIDMuNjk2Yy4xMi4zMTIuMjUyLjYwNC4zOTUuODcyLjU1MiAxLjAzNSAxLjIxOCAxLjY1IDEuODg3IDEuODU1VjExLjkxYy0uODEuMDMtMS41NzcuMTMtMi4yODIuMjg3em0uMTEgMi4yNzZhNi42OTYgNi42OTYgMCAwIDEtLjU5OC0uOTMzIDguODUzIDguODUzIDAgMCAxLS40ODEtMS4wNzkgOC4zOCA4LjM4IDAgMCAwLTEuMTk4LjQ5IDcuMDEgNy4wMSAwIDAgMCAyLjI3NiAxLjUyMnptLTEuMzgzLTIuOTY0QTEzLjM2IDEzLjM2IDAgMCAxIDMuNTA4IDguNWgtMi40OWE2Ljk2MyA2Ljk2MyAwIDAgMCAxLjM2MiAzLjY3NWMuNDctLjI1OC45OTUtLjQ4MiAxLjU2NS0uNjY3em02LjcyOCAyLjk2NGE3LjAwOSA3LjAwOSAwIDAgMCAyLjI3NS0xLjUyMSA4LjM3NiA4LjM3NiAwIDAgMC0xLjE5Ny0uNDkgOC44NTMgOC44NTMgMCAwIDEtLjQ4MSAxLjA3OCA2LjY4OCA2LjY4OCAwIDAgMS0uNTk3LjkzM3pNOC41IDExLjkwOXYzLjAxNGMuNjctLjIwNCAxLjMzNS0uODIgMS44ODctMS44NTUuMTQzLS4yNjguMjc2LS41Ni4zOTUtLjg3MkExMi42MyAxMi42MyAwIDAgMCA4LjUgMTEuOTF6bTMuNTU1LS40MDFjLjU3LjE4NSAxLjA5NS40MDkgMS41NjUuNjY3QTYuOTYzIDYuOTYzIDAgMCAwIDE0Ljk4MiA4LjVoLTIuNDlhMTMuMzYgMTMuMzYgMCAwIDEtLjQzNyAzLjAwOHpNMTQuOTgyIDcuNWE2Ljk2MyA2Ljk2MyAwIDAgMC0xLjM2Mi0zLjY3NWMtLjQ3LjI1OC0uOTk1LjQ4Mi0xLjU2NS42NjcuMjQ4LjkyLjQgMS45MzguNDM3IDMuMDA4aDIuNDl6TTExLjI3IDIuNDYxYy4xNzcuMzM0LjMzOS42OTQuNDgyIDEuMDc4YTguMzY4IDguMzY4IDAgMCAwIDEuMTk2LS40OSA3LjAxIDcuMDEgMCAwIDAtMi4yNzUtMS41MmMuMjE4LjI4My40MTguNTk3LjU5Ny45MzJ6bS0uNDg4IDEuMzQzYTcuNzY1IDcuNzY1IDAgMCAwLS4zOTUtLjg3MkM5LjgzNSAxLjg5NyA5LjE3IDEuMjgyIDguNSAxLjA3N1Y0LjA5Yy44MS0uMDMgMS41NzctLjEzIDIuMjgyLS4yODd6Ii8+Cjwvc3ZnPg==";
    } else if (faviconUrl.startsWith("data:")) {
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

    const [firstPart, ...rest] = dataUrl
      .split(";")
      .filter((part) => !part.startsWith("x-tabby-cat="));
    const newDataUrl = `${firstPart};x-tabby-cat=${tabGroup.color.slice(1)}/${
      tabGroup.groupId
    };${rest.join(";")}`;

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
