import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { UltimateWled } from './wledPlatform.js';
import { PLATFORM_NAME, PLUGIN_AUTHOR} from './settings.js';
import { WLEDClient } from 'wled-client';
import { hsvToRgb, rgbToHsv } from './utils.js';

export class WledAccessory {
  private lightService: Service;

  private lightStates = {
    On: false,
    Brightness: 100, // 0-100
    Hue: 0,          // 0-360
    Saturation: 0,   // 0-100
    Colors: [255, 0, 0],
  };

  private wledClient: WLEDClient;

  constructor(
    private readonly platform: UltimateWled,
    private readonly accessory: PlatformAccessory,
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

    this.wledClient = new WLEDClient('192.168.2.253');
  }

  async init() {
    // update accessory state
    this.wledClient.on('update:state', () => {
      this.onStateReceived();
    });

    await this.wledClient.init().catch(error => this.platform.log.error(error));

    this.lightService.updateCharacteristic(this.platform.Characteristic.FirmwareRevision, this.wledClient.info.version || 'NA');

    this.platform.log.debug('Wled', this.wledClient.info);
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
  async getOn(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get On ->', this.lightStates.On);

    return this.lightStates.On;
  }

  async getBrightness(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Brightness ->', this.lightStates.Brightness);

    return this.lightStates.Brightness;
  }

  async getHue(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Hue ->', this.lightStates.Hue);

    return this.lightStates.Hue;
  }

  async getSaturation(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Saturation ->', this.lightStates.Saturation);

    return this.lightStates.Saturation;
  }


  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    this.platform.log.debug('Set On ->', value);

    if (value as boolean) {
      await this.wledClient.turnOn();
    } else {
      await this.wledClient.turnOff();
    }
  }

  async setBrightness(value: CharacteristicValue) {
    this.platform.log.debug('Set Brightness -> ', value);

    await this.wledClient.setBrightness(value as number * 255 / 100);
  }

  async setHue(value: CharacteristicValue) {
    this.platform.log.debug('Set Hue -> ', value);

    const { r, g, b } = hsvToRgb(
      value as number / 360,
      this.lightStates.Saturation / 100,
      this.lightStates.Brightness / 100,
    );

    await this.wledClient.setColor([r, g, b]);
  }

  async setSaturation(value: CharacteristicValue) {
    this.platform.log.debug('Set Saturation -> ', value);

    const { r, g, b } = hsvToRgb(
      this.lightStates.Hue / 360,
      value as number / 100,
      this.lightStates.Brightness / 100,
    );

    await this.wledClient.setColor([r, g, b]);
  }

//
//   this.lightService
// .getCharacteristic(this.hap.Characteristic.Brightness)
// .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
//   // this.log.info('Brightness: '+this.brightness);
//   this.brightness = Math.round(this.brightness/255*100);
//   callback(undefined, this.brightness);
// })
// .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
//
//   this.brightness = Math.round(255 / 100 * (value as number));
//   this.httpSetBrightness();
//
//   if (this.prodLogging)
//     this.log.info("Set brightness to " + value + "% " + this.brightness);
//   callback();
// });
  private onStateReceived() {
    const state = this.wledClient.state;

    // this.platform.log.debug('State received -> ', this.wledClient.state);

    if (state.on != null && this.lightStates.On !== state.on) {
      this.lightStates.On = state.on;
      this.lightService.updateCharacteristic(this.platform.Characteristic.On, this.lightStates.On);
    }

    if (state.brightness != null && this.lightStates.Brightness !== state.brightness) {
      this.lightStates.Brightness = Math.round(state.brightness * 100 / 255);
      this.lightService.updateCharacteristic(this.platform.Characteristic.Brightness, this.lightStates.Brightness);
    }

    const colors = state.segments.at(0)?.colors?.at(0);
    if (colors != null && JSON.stringify(colors) !== JSON.stringify(this.lightStates.Colors)) {
      this.lightStates.Colors = colors;
      const { h, s } = rgbToHsv(colors[0], colors[1], colors[2]);
      this.lightStates.Hue = Math.round(h * 360);
      this.lightStates.Saturation = Math.round(s * 100);
      this.lightService.updateCharacteristic(this.platform.Characteristic.Hue, this.lightStates.Hue);
      this.lightService.updateCharacteristic(this.platform.Characteristic.Saturation, this.lightStates.Saturation);
    }
  }
}
