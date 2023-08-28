export const changeTitle: browser.runtime.onMessageVoid = (
  msg: unknown
): void => {
  const title = msg as string;
  document.title = title;
};

browser.runtime.onMessage.addListener(changeTitle);
