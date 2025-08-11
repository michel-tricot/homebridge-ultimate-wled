import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { UltimateWled } from './platform.js';
import { PLATFORM_NAME, PLUGIN_AUTHOR} from './settings';

export class WledAccessory {
  private lightService: Service;

  private lightStates = {
    On: false,
    Brightness: 100,
    Hue: 100,
    Saturation: 100,
    ColorArray: [255, 0, 0],
  };

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

    // this.wledClient = new WLEDClient(accessory.context.wled.host);
    // this.wledClient.init()
    //   .catch(error => this.platform.log.error(error));
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

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    const isOn = this.lightStates.On;

    this.platform.log.debug('Get On ->', isOn);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn;
  }

  async getBrightness(): Promise<CharacteristicValue> {
    const brightness = this.lightStates.Brightness as number;

    this.platform.log.debug('Get Brightness ->', brightness);
    return brightness;
  }

  async getHue(): Promise<CharacteristicValue> {
    const hue = this.lightStates.Hue as number;

    this.platform.log.debug('Get Hue ->', hue);
    return hue;
  }

  async getSaturation(): Promise<CharacteristicValue> {
    const saturation = this.lightStates.Saturation as number;

    this.platform.log.debug('Get Saturation ->', saturation);
    return saturation;
  }


  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    this.lightStates.On = value as boolean;

    this.platform.log.debug('Set On ->', value);
  }

  async setBrightness(value: CharacteristicValue) {
    this.lightStates.Brightness = value as number;

    this.platform.log.debug('Set Brightness -> ', value);
  }

  async setHue(value: CharacteristicValue) {
    this.lightStates.Hue = value as number;

    this.platform.log.debug('Set Hue -> ', value);
  }

  async setSaturation(value: CharacteristicValue) {
    this.lightStates.Saturation = value as number;

    this.platform.log.debug('Set Saturation -> ', value);
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
}
