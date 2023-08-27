import type { Maybe } from "./Maybe";

export type Favicon = string | Blob;

export interface FaviconData {
  favicon: Maybe<Favicon>;
  color: string;
}
