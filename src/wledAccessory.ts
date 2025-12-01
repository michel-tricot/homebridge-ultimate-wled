import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import util from 'util';

import type { UltimateWled } from './wledPlatform.js';
import { PLATFORM_NAME, PLUGIN_AUTHOR } from './settings.js';
import { WLEDClient } from 'wled-client';
import convert, { HSV } from 'color-convert';
import { WLEDConfiguration } from './@types/config';

class WledState {
  on = false;
  hsv = [255, 0, 0];
  colors = [255, 0, 0];
  private brightness = 100;
  currentPreset: number = -1;

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

    const logMethod = (d: unknown) => {
      o.platform.log.debug(`${String(propertyKey)}(${util.inspect(args)}) -> ${d !== undefined ? d : 'void'}`);
      return d;
    };

    const result = originalMethod.apply(this, args);

    return result instanceof Promise
      ? result.then(logMethod)
      : logMethod(result);
  };
}

function cleanState<T extends { segments?: unknown }>(state: T): Omit<T, 'segments'> {
  const { segments, ...rest } = state;
  void segments;
  return rest;
}

function cleanPresets<T>(presets: Record<string, T>): Record<string, T> {
  const { 0: _zero, ...rest } = presets;
  void _zero;
  return rest;
}

export class WledAccessory {
  private lightService: Service;
  private presetServices = new Map<number, Service>();

  wledStates: WledState = new WledState();
  private wledClient: WLEDClient;

  constructor(
    public readonly platform: UltimateWled,
    public readonly accessory: PlatformAccessory,
  ) {
    const wledConfig = this.accessory.context.wled as WLEDConfiguration;

    this.wledClient = new WLEDClient({
      host: wledConfig.ip,
      websocket: {
        reconnect: true,
      },
      immediate: true,
      init: {
        presets: true,
      },
    });

    this.configureAccessory(wledConfig.name);
    this.lightService = this.configureLightService();
  }

  private configureAccessory(name: string) {
    const { Service, Characteristic } = this.platform;

    const infoService =
      this.accessory.getService(Service.AccessoryInformation) ??
      this.accessory.addService(Service.AccessoryInformation);

    infoService
      .setCharacteristic(Characteristic.Manufacturer, PLATFORM_NAME)
      .setCharacteristic(Characteristic.Model, PLUGIN_AUTHOR)
      .setCharacteristic(Characteristic.SerialNumber, 'NA')
      .setCharacteristic(Characteristic.FirmwareRevision, this.wledClient.info.version || 'NA')
      .setCharacteristic(Characteristic.Name, name || 'WLED Strip');
  }

  private configureLightService() {
    const { Service, Characteristic } = this.platform;

    const stripName = 'Strip';
    const subtype = 'strip-main';

    const lightService =
        this.accessory.getServiceById(Service.Lightbulb, subtype) ??
        this.accessory.addService(Service.Lightbulb, stripName, subtype);

    lightService.setPrimaryService(true);

    lightService.setCharacteristic(Characteristic.Name, stripName);

    if (Characteristic.ConfiguredName) {
      if (!lightService.testCharacteristic(Characteristic.ConfiguredName)) {
        lightService.addOptionalCharacteristic(Characteristic.ConfiguredName);
      }
      lightService.setCharacteristic(Characteristic.ConfiguredName, stripName);
    }

    lightService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(v => this.setOn(v))
      .onGet(() => this.getOn());
    lightService.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(v => this.setBrightness(v))
      .onGet(() => this.getBrightness());
    lightService.getCharacteristic(this.platform.Characteristic.Hue)
      .onSet(v => this.setHue(v))
      .onGet(() => this.getHue());
    lightService.getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet(v => this.setSaturation(v))
      .onGet(() => this.getSaturation());

    return lightService;
  }

  async init() {
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

    // updated presets event isn't predictable
    setInterval(() => {
      this.wledClient.refreshPresets().catch(error => this.platform.log.error('Failed to refresh presets:', error));
    }, 10000);
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
  async getPresetOn(id: number): Promise<CharacteristicValue> {
    return this.wledStates.on && this.wledStates.currentPreset === id;
  }

  @monitorMethod
  async setOn(value: CharacteristicValue) {
    const on = value as boolean;

    if (on) {
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
  async setPresetOn(id: number, value: CharacteristicValue) {
    if (value as boolean) {
      this.wledStates.currentPreset = id;
      await this.wledClient.setPreset(this.wledStates.currentPreset);
      await this.setOn(true);
    } else {
      await this.setOn(false);
    }
  }

  private async onStateReceived() {
    const state = this.wledClient.state;

    this.platform.log.debug(`State received: ${JSON.stringify(cleanState(state), null, 2)}`);

    let turnedOn = false;
    if (state.on !== undefined && state.on !== this.wledStates.on) {
      this.wledStates.on = state.on;

      if (state.on) {
        turnedOn = true;
      }

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

    // When turning on state can receive -1
    if (turnedOn && state.presetId !== -1) {
      this.wledStates.currentPreset = state.presetId || -1;
    }
    for (const [id, presetService] of this.presetServices) {
      presetService.updateCharacteristic(this.platform.Characteristic.On, this.wledStates.on && this.wledStates.currentPreset === id);
    }
  }

  private onPresetsReceived() {
    const { Service, Characteristic } = this.platform;

    const presets = cleanPresets(this.wledClient.presets);

    this.platform.log.debug('Presets received');

    const activePresets = new Map<number, Service>();
    const validSubtypes = new Set<string>();
    for (const [rawkey, preset] of Object.entries(presets)) {
      const id = parseInt(rawkey);
      const name = preset.name;

      this.platform.log.debug(`Preset: ${id} - ${name}`);

      const subtype = `Preset-Switch-${id}-${name}`;

      const service =
        this.accessory.getServiceById(Service.Switch, subtype) ??
        this.accessory.addService(Service.Switch, name, subtype);

      service.setCharacteristic(Characteristic.Name, name);
      if (Characteristic.ConfiguredName) {
        if (!service.testCharacteristic(Characteristic.ConfiguredName)) {
          service.addOptionalCharacteristic(Characteristic.ConfiguredName);
        }
        service.setCharacteristic(Characteristic.ConfiguredName, name);
      }

      service.getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => this.getPresetOn(id))
        .onSet((v) => this.setPresetOn(id, v));

      this.lightService.addLinkedService(service);
      activePresets.set(id, service);
      validSubtypes.add(subtype);
    }

    for (const service of this.accessory.services) {
      const subtype = service.subtype;
      if (subtype !== undefined && subtype.startsWith('Preset-Switch-') && !validSubtypes.has(subtype)) {
        this.platform.log.debug(`Removing stale preset service with subtype ${subtype}`);
        this.accessory.removeService(service);
      }
    }

    this.presetServices = activePresets;
  }
}
