import { isLog } from "../devices/actions";
import {
  bothUp,
  actOnChannelName,
  showLogOnScreen,
  speakLogAloud,
  initLog
} from "./connect_device";
import { GetState } from "../redux/interfaces";
import { dispatchNetworkDown } from ".";
import { Log } from "../interfaces";
import * as _ from "lodash";

const LEGACY_META_KEY_NAMES: (keyof Log)[] = [
  "type",
  "x",
  "y",
  "z",
  "verbosity",
  "major_version",
  "minor_version"
];

function legacyKeyTransformation(log: Log,
  key: keyof Log) {
  const before = log[key];
  // You don't want to use || here, trust me. -RC
  log[key] = !_.isUndefined(before) ? before : _.get(log, ["meta", key], undefined);
}

class BatchQueue {
  private queue: Function[] = [];
  private timerId = 0;

  constructor(workRate = 600) {
    this.timerId = window.setInterval(this.work, workRate);
  }

  work = () => {
    this.queue.map(fn => fn());
    this.clear();
  }
  push = (job: Function) => this.queue.push(job);
  clear = () => this.queue = [];
  destroy = () => window.clearInterval(this.timerId);
}

const q = new BatchQueue(600);

export const onLogs =
  (dispatch: Function, getState: GetState) => (msg: Log) => {
    bothUp();
    if (isLog(msg)) {
      LEGACY_META_KEY_NAMES.map(key => legacyKeyTransformation(msg, key));
      actOnChannelName(msg, "toast", showLogOnScreen);
      actOnChannelName(msg, "espeak", speakLogAloud(getState));
      q.push(() => {
        dispatch(initLog(msg));
        // CORRECT SOLUTION: Give each device its own topic for publishing
        //                   MQTT last will message.
        // FAST SOLUTION:    We would need to re-publish FBJS and FBOS to
        //                   change topic structure. Instead, we will use
        //                   inband signalling (for now).
        // TODO:             Make a `bot/device_123/offline` channel.
        const died =
          msg.message.includes("is offline") && msg.type === "error";
        died && dispatchNetworkDown("bot.mqtt");
      });
    }
  };
