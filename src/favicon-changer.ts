import type { FaviconData } from "./models/Favicon";
import type { Maybe } from "./models/Maybe";
import IconSilhouette from "bundle-text:./icons/silhouette.svg";

const changeFavicon: browser.runtime.onMessageVoid = async (faviconData) => {
  const faviconDataCast = faviconData as FaviconData;
  let favicon = faviconDataCast.favicon;
  const color = faviconDataCast.color;

  let icon = (document.querySelector('link[rel="icon"]') ??
    document.querySelector(
      'link[rel="shortcut icon"]'
    )) as Maybe<HTMLLinkElement>;

  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.append(icon);
  }

  icon.setAttribute("data-tabby-cat", "true");

  if (!favicon) {
    try {
      const resp = await fetch(`${window.location.origin}/favicon.ico`);

      if (resp.headers.get("content-type") !== "image/x-icon") {
        throw new Error();
      }

      favicon = await resp.blob();
    } catch {
      // caught ⚾🧤
    }
  }

  let dataUrl: Maybe<string> = null;
  const iconSilhouette = new DOMParser()
    .parseFromString(IconSilhouette, "image/svg+xml")
    .documentElement.querySelector("path");
  if (typeof favicon === "string") {
    const svg = new DOMParser().parseFromString(
      favicon,
      "image/svg+xml"
    ).documentElement;

    const originalViewbox = svg.getAttribute("viewBox")?.split(" ");
    if (originalViewbox) {
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.setAttribute("height", "16");
      svg.setAttribute("width", "16");

      const xmlSerializer = new XMLSerializer();

      if (iconSilhouette) {
        iconSilhouette.setAttribute("fill", color);
        iconSilhouette.setAttribute("transform", "translate(11, 12)");

        svg.append(iconSilhouette);

        const svgSerialized = encodeURIComponent(
          xmlSerializer.serializeToString(svg)
        );
        dataUrl = `data:image/svg+xml;x-tabby-cat=true,${svgSerialized}`;
      }
    }
  } else if (favicon) {
    const canvas = document.createElement("canvas");
    canvas.height = 16;
    canvas.width = 16;
    const ctx = canvas.getContext("2d");

    if (ctx && iconSilhouette) {
      const bitmap = await createImageBitmap(favicon);

      ctx.drawImage(bitmap, 0, 0, 16, 16);

      ctx.fillStyle = color;
      const matrix = document
        .createElementNS("http://www.w3.org/2000/svg", "svg")
        .createSVGMatrix()
        .scale(0.5, 0.5)
        .translate(12, 12);
      const path = new Path2D(iconSilhouette.getAttribute("d")!);
      const silhouette = new Path2D();
      silhouette.addPath(path, matrix);
      ctx.fill(silhouette);

      const canvasDataUrl = canvas.toDataURL();
      dataUrl =
        canvasDataUrl.slice(0, 14) +
        ";x-tabby-cat=true" +
        canvasDataUrl.slice(14);
    }
  }

  if (dataUrl) {
    icon.href = dataUrl;
  }
};

window.addEventListener("DOMContentLoaded", () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node instanceof HTMLLinkElement &&
          /^(shortcut )?icon$/.test(node.rel) &&
          node.getAttribute("data-tabby-cat") === null
        ) {
          node.remove();
        }
      });
    });
  });

  observer.observe(document.head, {
    childList: true,
  });
});

browser.runtime.onMessage.addListener(changeFavicon);
