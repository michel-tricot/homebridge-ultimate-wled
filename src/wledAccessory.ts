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
  currentPreset: number | undefined = 0;

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
  private presetServices = new Map<number, Service>();

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
      this.accessory.addService(this.platform.Service.Lightbulb, 'Strip', 'Strip');
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
    this.lightService.setPrimaryService(true);

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
  async getPresetState(id: number): Promise<CharacteristicValue> {
    return this.wledStates.currentPreset === id;
  }

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
  async setPresetState(id: number, value: CharacteristicValue) {
    if (value as boolean) {
      this.wledStates.currentPreset = id;
      await this.wledClient.setPreset(this.wledStates.currentPreset);
    }
  }

  private async onStateReceived() {
    const state = this.wledClient.state;

    this.platform.log.debug('State received', state);

    await this.wledClient.refreshPresets();

    if (state.on != null) {
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

    for (const [id, presetService] of this.presetServices) {
      this.wledStates.currentPreset = state.presetId;
      presetService.updateCharacteristic(this.platform.Characteristic.On, this.wledStates.on && this.wledStates.currentPreset === id);
    }
  }

  private onPresetsReceived() {
    const presets = this.wledClient.presets;

    this.platform.log.debug('Presets received', presets);

    const currentServices = new Map<number, Service>();
    const validSubtypes = new Set<string>();
    for (const rawkey of Object.keys(presets)) {
      const id = parseInt(rawkey);

      if (id === 0) { // remove default empty
        continue;
      }

      const preset = presets[id];
      const name = preset.name || 'Default';
      const subtype = `Preset-Switch-${id}-${name}`;

      const inputService = this.accessory.getService(subtype) ||
        this.accessory.addService(this.platform.Service.Switch, name, subtype);
      inputService.setCharacteristic(this.platform.Characteristic.Name, name);
      inputService.getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => this.getPresetState(id))
        .onSet((v) => this.setPresetState(id, v));

      if (!inputService.testCharacteristic(this.platform.Characteristic.ConfiguredName)) {
        inputService.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      }
      inputService.setCharacteristic(this.platform.Characteristic.ConfiguredName, name);

      this.platform.log.debug(`Strip name ${this.lightService.getCharacteristic(this.platform.Characteristic.Name).value}`);

      currentServices.set(id, inputService);
      validSubtypes.add(subtype);
    }

    for (const service of this.lightService.linkedServices) {
      if (service.subtype === undefined || !validSubtypes.has(service.subtype)) {
        this.platform.log.debug(`Removing old preset ${service.subtype}`);
        this.lightService.removeLinkedService(service);
        this.accessory.removeService(service);
      }
    }

    this.presetServices.clear();
    for (const [id, service] of currentServices) {
      this.lightService.addLinkedService(service);
      this.presetServices.set(id, service);
    }
  }
}
