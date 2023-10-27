export const UPDATE_MSG_TYPE = "UPDATE";

export interface UpdateMessage {
  messageType: typeof UPDATE_MSG_TYPE;
  tabIds: number[];
}
