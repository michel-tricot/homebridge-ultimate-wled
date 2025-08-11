import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { UltimateWled } from './wledPlatform.js';
import { PLATFORM_NAME, PLUGIN_AUTHOR } from './settings.js';
import { WLEDClient } from 'wled-client';
import convert, { HSV } from 'color-convert';

class LightState {
  on = false;
  hsv = [255, 0, 0];
  colors = [255, 0, 0];
  private brightness = 100;

  set wledBrightness(wledBrightness: number) {
    this.brightness = LightState.toHkBrightness(wledBrightness);
  }

  get wledBrightness() {
    return LightState.toWledBrightness(this.brightness);
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

  private lightStates: LightState = new LightState();

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

    this.wledClient.on('open', () => {
      this.platform.log.debug('✅ - Connection has been opened');
    });

    this.wledClient.on('close', () => {
      this.platform.log.debug('❌ - Connection has been closed');
    });

    await this.wledClient.init().catch(error => this.platform.log.error(error));

    this.lightService.updateCharacteristic(this.platform.Characteristic.FirmwareRevision, this.wledClient.info.version || 'NA');

    // this.platform.log.debug('Wled', this.wledClient.info);
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
    return this.lightStates.on;
  }

  @monitorMethod
  async getBrightness(): Promise<CharacteristicValue> {
    return this.lightStates.hkBrightness;
  }

  @monitorMethod
  async getHue(): Promise<CharacteristicValue> {
    return this.lightStates.hsv[0];
  }

  @monitorMethod
  async getSaturation(): Promise<CharacteristicValue> {
    return this.lightStates.hsv[1];
  }


  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  @monitorMethod
  async setOn(value: CharacteristicValue) {
    this.lightStates.on = value as boolean;

    if (this.lightStates.on) {
      await this.wledClient.turnOn();
    } else {
      await this.wledClient.turnOff();
    }
  }

  @monitorMethod
  async setBrightness(value: CharacteristicValue) {
    this.lightStates.hkBrightness = value as number;

    await this.wledClient.setBrightness(this.lightStates.wledBrightness);
  }

  @monitorMethod
  async setHue(value: CharacteristicValue) {
    this.lightStates.hsv[0] = value as number;

    const hsv: HSV = [
      this.lightStates.hsv[0],
      this.lightStates.hsv[1],
      this.lightStates.hkBrightness,
    ];

    const rgb = convert.hsv.rgb(hsv);

    await this.wledClient.setColor(rgb);
  }

  @monitorMethod
  async setSaturation(value: CharacteristicValue) {
    this.lightStates.hsv[1] = value as number;

    const hsv: HSV = [
      this.lightStates.hsv[0],
      this.lightStates.hsv[1],
      this.lightStates.hkBrightness,
    ];

    const rgb = convert.hsv.rgb(hsv);

    await this.wledClient.setColor(rgb);
  }

  private onStateReceived() {
    const state = this.wledClient.state;

    if (state.on != null && this.lightStates.on !== state.on) {
      this.lightStates.on = state.on;
      this.lightService.updateCharacteristic(this.platform.Characteristic.On, this.lightStates.on);
    }

    if (state.brightness != null && this.lightStates.wledBrightness !== state.brightness) {
      this.lightStates.wledBrightness = state.brightness;
      this.lightService.updateCharacteristic(this.platform.Characteristic.Brightness, this.lightStates.hkBrightness);
    }

    const colors = state.segments.at(0)?.colors?.at(0);
    if (colors != null) {
      const hsv = convert.rgb.hsv(colors[0], colors[1], colors[2]);

      if (JSON.stringify(this.lightStates.hsv) !== JSON.stringify(hsv)) {
        this.lightStates.colors = colors;
        this.lightStates.hsv = hsv;

        this.lightService.updateCharacteristic(this.platform.Characteristic.Hue, this.lightStates.hsv[0]);
        this.lightService.updateCharacteristic(this.platform.Characteristic.Saturation, this.lightStates.hsv[1]);
      }

    }
  }
}
