import React from "react";
import { connect, ConnectedComponent } from "react-redux";
import { error, warning } from "./toast/toast";
import { NavBar } from "./nav";
import { Everything, TimeSettings } from "./interfaces";
import { LoadingPlant } from "./loading_plant";
import { BotState, UserEnv } from "./devices/interfaces";
import {
  ResourceName, TaggedUser, TaggedLog, Xyz, Alert, FirmwareHardware,
  TaggedWizardStepResult,
  TaggedTelemetry,
} from "farmbot";
import {
  maybeFetchUser,
  maybeGetTimeSettings,
  getDeviceAccountSettings,
  selectAllWizardStepResults,
  selectAllTelemetry,
} from "./resources/selectors";
import { HotKeys } from "./hotkeys";
import { ControlsPopup } from "./controls_popup";
import { Content } from "./constants";
import { validBotLocationData, validFwConfig } from "./util";
import { BooleanSetting, StringSetting } from "./session_keys";
import {
  getWebAppConfigValue, GetWebAppConfigValue,
} from "./config_storage/actions";
import { takeSortedLogs } from "./logs/state_to_props";
import { FirmwareConfig } from "farmbot/dist/resources/configs/firmware";
import { getFirmwareConfig, getFbosConfig } from "./resources/getters";
import { intersection, isString } from "lodash";
import { t } from "./i18next_wrapper";
import { ResourceIndex } from "./resources/interfaces";
import { isBotOnlineFromState } from "./devices/must_be_online";
import { getAllAlerts } from "./messages/state_to_props";
import { PingDictionary } from "./devices/connectivity/qos";
import { getEnv } from "./farmware/state_to_props";
import { filterAlerts } from "./messages/alerts";
import {
  getFwHardwareValue,
} from "./settings/firmware/firmware_hardware_support";
import { HelpState } from "./help/reducer";
import { TourStepContainer } from "./help/tours";
import { ToastMessages } from "./toast/interfaces";
import { Toasts } from "./toast/fb_toast";
import Bowser from "bowser";
import { landingPagePath, Path } from "./internal_urls";
import { push } from "./history";

export interface AppProps {
  dispatch: Function;
  loaded: ResourceName[];
  logs: TaggedLog[];
  user: TaggedUser | undefined;
  bot: BotState;
  timeSettings: TimeSettings;
  axisInversion: Record<Xyz, boolean>;
  xySwap: boolean;
  firmwareConfig: FirmwareConfig | undefined;
  animate: boolean;
  getConfigValue: GetWebAppConfigValue;
  helpState: HelpState;
  resources: ResourceIndex;
  alertCount: number;
  alerts: Alert[];
  apiFirmwareValue: FirmwareHardware | undefined;
  pings: PingDictionary;
  env: UserEnv;
  authAud: string | undefined;
  wizardStepResults: TaggedWizardStepResult[];
  telemetry: TaggedTelemetry[];
  toastMessages: ToastMessages;
  controlsPopupOpen: boolean;
  children?: React.ReactNode;
}

export function mapStateToProps(props: Everything): AppProps {
  const webAppConfigValue = getWebAppConfigValue(() => props);
  return {
    timeSettings: maybeGetTimeSettings(props.resources.index),
    dispatch: props.dispatch,
    user: maybeFetchUser(props.resources.index),
    bot: props.bot,
    logs: takeSortedLogs(250, props.resources.index),
    loaded: props.resources.loaded,
    axisInversion: {
      x: !!webAppConfigValue(BooleanSetting.x_axis_inverted),
      y: !!webAppConfigValue(BooleanSetting.y_axis_inverted),
      z: !!webAppConfigValue(BooleanSetting.z_axis_inverted),
    },
    xySwap: !!webAppConfigValue(BooleanSetting.xy_swap),
    firmwareConfig: validFwConfig(getFirmwareConfig(props.resources.index)),
    animate: !webAppConfigValue(BooleanSetting.disable_animations),
    getConfigValue: webAppConfigValue,
    helpState: props.resources.consumers.help,
    resources: props.resources.index,
    alertCount: getAllAlerts(props.resources).filter(filterAlerts).length,
    alerts: getAllAlerts(props.resources),
    apiFirmwareValue: getFwHardwareValue(getFbosConfig(props.resources.index)),
    pings: props.bot.connectivity.pings,
    env: getEnv(props.resources.index),
    authAud: props.auth?.token.unencoded.aud,
    wizardStepResults: selectAllWizardStepResults(props.resources.index),
    telemetry: selectAllTelemetry(props.resources.index),
    toastMessages: props.app.toasts,
    controlsPopupOpen: props.app.controlsPopupOpen,
  };
}
/** Time at which the app gives up and asks the user to refresh */
const LOAD_TIME_FAILURE_MS = 25000;

/**
 * Relational resources that *must* load before app starts.
 * App will crash at load time if they are not pre-loaded.
 */
const MUST_LOAD: ResourceName[] = [
  "Sequence",
  "Regimen",
  "FarmEvent",
  "Point",
  "Device",
  "Tool", // Sequence editor needs this for rendering.
];

export class RawApp extends React.Component<AppProps, {}> {
  private get isLoaded() {
    return (MUST_LOAD.length ===
      intersection(this.props.loaded, MUST_LOAD).length);
  }

  /**
 * If the sync object takes more than 10s to load, the user will be granted
 * access into the app, but still warned.
 */
  componentDidMount() {
    setTimeout(() => {
      if (!this.isLoaded) {
        error(t(Content.APP_LOAD_TIMEOUT_MESSAGE), { title: t("Warning") });
      }
    }, LOAD_TIME_FAILURE_MS);
    const browser = Bowser.getParser(window.navigator.userAgent);
    !browser.satisfies({ chrome: ">85", firefox: ">75", edge: ">85" }) &&
      warning(t(Content.UNSUPPORTED_BROWSER));
  }

  render() {
    const syncLoaded = this.isLoaded;
    const { bot, dispatch, getConfigValue } = this.props;
    const { location_data, mcu_params } = bot.hardware;
    const { busy, locked } = bot.hardware.informational_settings;
    const landingPage = getConfigValue(StringSetting.landing_page);
    if (Path.equals("") && isString(landingPage)) {
      push(landingPagePath(landingPage));
    }
    return <div className="app">
      {!syncLoaded && <LoadingPlant animate={this.props.animate} />}
      <HotKeys dispatch={dispatch} />
      {syncLoaded && <NavBar
        timeSettings={this.props.timeSettings}
        user={this.props.user}
        bot={bot}
        dispatch={dispatch}
        logs={this.props.logs}
        getConfigValue={getConfigValue}
        helpState={this.props.helpState}
        alertCount={this.props.alertCount}
        device={getDeviceAccountSettings(this.props.resources)}
        alerts={this.props.alerts}
        apiFirmwareValue={this.props.apiFirmwareValue}
        authAud={this.props.authAud}
        wizardStepResults={this.props.wizardStepResults}
        telemetry={this.props.telemetry}
        pings={this.props.pings} />}
      {syncLoaded && this.props.children}
      {!Path.startsWith(Path.controls()) &&
        <ControlsPopup
          dispatch={dispatch}
          isOpen={this.props.controlsPopupOpen}
          botPosition={validBotLocationData(location_data).position}
          firmwareSettings={this.props.firmwareConfig || mcu_params}
          arduinoBusy={busy}
          locked={locked}
          botOnline={isBotOnlineFromState(bot)}
          getConfigValue={getConfigValue}
          env={this.props.env}
          stepSize={bot.stepSize} />}
      <div className={"toast-container"}>
        <TourStepContainer
          key={JSON.stringify(this.props.helpState)}
          dispatch={dispatch}
          firmwareHardware={this.props.apiFirmwareValue}
          helpState={this.props.helpState} />
        <Toasts
          toastMessages={this.props.toastMessages}
          dispatch={dispatch} />
      </div>
    </div>;
  }
}

export const App = connect(mapStateToProps)(
  RawApp) as ConnectedComponent<typeof RawApp, { children?: React.ReactNode }>;
