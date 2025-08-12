import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { UltimateWled } from './wledPlatform.js';
import { PLATFORM_NAME, PLUGIN_AUTHOR } from './settings.js';
import { WLEDClient } from 'wled-client';
import convert, { HSV } from 'color-convert';

class WledState {
  on = false;
  hsv = [255, 0, 0];
  colors = [255, 0, 0];
  private brightness = 100;
  presetsActive = false;
  currentPreset = 0;

  set wledBrightness(wledBrightness: number) {
    this.brightness = WledState.toHkBrightness(wledBrightness);
  }

  get wledBrightness() {
    return WledState.toWledBrightness(this.brightness);
  }

  set hkBrightness(hkBrightness: number) {
    this.brightness = hkBrightness;
  }

  get hkBrightness() {
    return this.brightness;
  }

  static toHkBrightness(wledBrightness: number) {
    return Math.round(wledBrightness * 100 / 255);
  }

  static toWledBrightness(hkBrightness: number) {
    return Math.round(hkBrightness * 255 / 100);
  }

}

function monitorMethod(target: object, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: never[]) {
    const o = this as WledAccessory;

    const relevantArgs = args.slice(0, -2);

    const logMethod = (d: unknown) => {
      o.platform.log.debug(`${String(propertyKey)}(${relevantArgs.length > 0 ? relevantArgs : ''}) -> ${d !== undefined ? d : 'void'}`);
      return d;
    };

    const result = originalMethod.apply(this, args);

    return result instanceof Promise
      ? result.then(logMethod)
      : logMethod(result);
  };
}

export class WledAccessory {
  private lightService: Service;
  private presetsService: Service;
  private inputServices = new Map<string, Service>();

  private wledStates: WledState = new WledState();
  private wledClient: WLEDClient;

  constructor(
    public readonly platform: UltimateWled,
    public readonly accessory: PlatformAccessory,
  ) {
    // Configure Accessory
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, PLATFORM_NAME)
      .setCharacteristic(this.platform.Characteristic.Model, PLUGIN_AUTHOR)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'NA');

    // Configure Light
    this.lightService = this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);
    this.lightService.setCharacteristic(this.platform.Characteristic.Name, 'Strip');
    this.lightService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
    this.lightService.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))
      .onGet(this.getBrightness.bind(this));
    this.lightService.getCharacteristic(this.platform.Characteristic.Hue)
      .onSet(this.setHue.bind(this))
      .onGet(this.getHue.bind(this));
    this.lightService.getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet(this.setSaturation.bind(this))
      .onGet(this.getSaturation.bind(this));

    // Configure Presets
    this.presetsService = this.accessory.getService(this.platform.Service.Television) ||
      this.accessory.addService(this.platform.Service.Television);
    this.presetsService.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Presets');
    this.presetsService.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getPresetsActive.bind(this))
      .onSet(this.setPresetsActive.bind(this));
    this.presetsService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .onGet(this.getCurrentPreset.bind(this))
      .onSet(this.setCurrentPreset.bind(this));

    this.wledClient = new WLEDClient({
      host: '192.168.2.253',
      websocket: {
        reconnect: true,
      },

    });
  }

  async init() {
    // update accessory state
    this.wledClient.on('update:state', () => {
      this.onStateReceived();
    });

    this.wledClient.on('update:presets', () => {
      this.onPresetsReceived();
    });

    this.wledClient.on('open', () => {
      this.platform.log.debug('✅ - Connection has been opened');
    });

    this.wledClient.on('close', () => {
      this.platform.log.debug('❌ - Connection has been closed');
    });

    await this.wledClient.init().catch(error => this.platform.log.error(error));

    this.lightService.updateCharacteristic(this.platform.Characteristic.FirmwareRevision, this.wledClient.info.version || 'NA');
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possible. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.
   * In this case, you may decide not to implement `onGet` handlers, which may speed up
   * the responsiveness of your device in the Home app.
   * if you need to return an error to show the device as "Not Responding" in the Home app:
   * throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  @monitorMethod
  async getOn(): Promise<CharacteristicValue> {
    return this.wledStates.on;
  }

  @monitorMethod
  async getBrightness(): Promise<CharacteristicValue> {
    return this.wledStates.hkBrightness;
  }

  @monitorMethod
  async getHue(): Promise<CharacteristicValue> {
    return this.wledStates.hsv[0];
  }

  @monitorMethod
  async getSaturation(): Promise<CharacteristicValue> {
    return this.wledStates.hsv[1];
  }

  @monitorMethod
  async getPresetsActive(): Promise<CharacteristicValue> {
    return this.wledStates.presetsActive;
  }

  @monitorMethod
  async getCurrentPreset(): Promise<CharacteristicValue> {
    return Math.max(0, this.wledStates.currentPreset);
  }


  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  @monitorMethod
  async setOn(value: CharacteristicValue) {
    this.wledStates.on = value as boolean;

    if (this.wledStates.on) {
      await this.wledClient.turnOn();
    } else {
      await this.wledClient.turnOff();
    }
  }

  @monitorMethod
  async setBrightness(value: CharacteristicValue) {
    this.wledStates.hkBrightness = value as number;

    await this.wledClient.setBrightness(this.wledStates.wledBrightness);
  }

  @monitorMethod
  async setHue(value: CharacteristicValue) {
    this.wledStates.hsv[0] = value as number;

    const hsv: HSV = [
      this.wledStates.hsv[0],
      this.wledStates.hsv[1],
      this.wledStates.hkBrightness,
    ];

    const rgb = convert.hsv.rgb(hsv);

    await this.wledClient.setColor(rgb);
  }

  @monitorMethod
  async setSaturation(value: CharacteristicValue) {
    this.wledStates.hsv[1] = value as number;

    const hsv: HSV = [
      this.wledStates.hsv[0],
      this.wledStates.hsv[1],
      this.wledStates.hkBrightness,
    ];

    const rgb = convert.hsv.rgb(hsv);

    await this.wledClient.setColor(rgb);
  }

  @monitorMethod
  async setPresetsActive(value: CharacteristicValue) {
    this.wledStates.presetsActive = value as boolean;

    await this.wledClient.refreshPresets();
  }

  @monitorMethod
  async setCurrentPreset(value: CharacteristicValue) {
    this.wledStates.currentPreset = value as number;
  }


  private onStateReceived() {
    const state = this.wledClient.state;

    this.platform.log.debug('State received', state);

    if (state.on != null && this.wledStates.on !== state.on) {
      this.wledStates.on = state.on;
      this.lightService.updateCharacteristic(this.platform.Characteristic.On, this.wledStates.on);
    }

    if (state.brightness != null && this.wledStates.wledBrightness !== state.brightness) {
      this.wledStates.wledBrightness = state.brightness;
      this.lightService.updateCharacteristic(this.platform.Characteristic.Brightness, this.wledStates.hkBrightness);
    }

    const colors = state.segments.at(0)?.colors?.at(0);
    if (colors != null) {
      const hsv = convert.rgb.hsv(colors[0], colors[1], colors[2]);

      if (JSON.stringify(this.wledStates.hsv) !== JSON.stringify(hsv)) {
        this.wledStates.colors = colors;
        this.wledStates.hsv = hsv;

        this.lightService.updateCharacteristic(this.platform.Characteristic.Hue, this.wledStates.hsv[0]);
        this.lightService.updateCharacteristic(this.platform.Characteristic.Saturation, this.wledStates.hsv[1]);
      }

    }

    if (state.presetId != null &&
      (state.presetId >= 0 !== this.wledStates.presetsActive ||
      (this.wledStates.presetsActive && state.presetId !== this.wledStates.currentPreset))) {
      this.wledStates.currentPreset = state.presetId >= 0 ? state.presetId : this.wledStates.currentPreset;
      this.wledStates.presetsActive = state.presetId >= 0;
      this.presetsService.updateCharacteristic(this.platform.Characteristic.Active, this.wledStates.presetsActive);
      this.presetsService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.wledStates.currentPreset);
    }
  }


  private onPresetsReceived() {
    const presets = this.wledClient.presets;

    this.platform.log.debug('Presets received', presets);

    const originalServices = new Map<string, Service>();
    const linkedServicesCopy = [...this.presetsService.linkedServices];
    for (const linkService of linkedServicesCopy) {
      if (linkService.subtype === undefined) {
        this.presetsService.removeLinkedService(linkService);
        this.platform.log.debug('Removing invalid service', linkService);
        continue;
      }
      originalServices.set(linkService.subtype, linkService);
    }

    const validPresets = new Set();
    for (const rawkey of Object.keys(presets)) {
      const id = parseInt(rawkey);
      const preset = presets[id];
      const name = preset.name || 'Default';
      const subtype = `Preset-${id}-${name}`;

      const inputService = this.accessory.getService(subtype) ||
        this.accessory.addService(this.platform.Service.InputSource, name, subtype);
      inputService
        .setCharacteristic(this.platform.Characteristic.Identifier, id)
        .setCharacteristic(this.platform.Characteristic.ConfiguredName, name)
        .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.HDMI);
      this.presetsService.addLinkedService(inputService);
      validPresets.add(subtype);
    }

    for (const [subtype, originalService] of originalServices) {
      if (!validPresets.has(subtype)) {
        this.platform.log.debug(`${subtype} not available anymore`);
        this.presetsService.removeLinkedService(originalService);
      }
    }
  }
}
