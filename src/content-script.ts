import type { Maybe } from "./models/Maybe";
import type { ContentScriptMessage } from "./models/Tabs";

const changeTitle = (title: string): void => {
  document.title = title;
};

const changeFavicon = (faviconDataUrl: string): void => {
  let faviconLink = document.querySelector(
    "link[rel~='icon']"
  ) as Maybe<HTMLLinkElement>;

  if (faviconLink == null) {
    faviconLink = document.createElement("link");
    document.head.append(faviconLink);
  }

  faviconLink.href = faviconDataUrl;
};

const receiveMessage: browser.runtime.onMessageVoid = (
  message: unknown
): void => {
  const msg = message as ContentScriptMessage;

  switch (msg.changeAction) {
    case "TITLE": {
      changeTitle(msg.msg);
      break;
    }
    case "FAVICON": {
      changeFavicon(msg.msg);
      break;
    }
    default: {
      throw new Error(`Invalid action: ${msg.changeAction}.`);
    }
  }
};

browser.runtime.onMessage.addListener(receiveMessage);
