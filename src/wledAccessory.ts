import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { UltimateWled } from './wledPlatform.js';
import { PLATFORM_NAME, PLUGIN_AUTHOR } from './settings.js';
import { WLEDClient } from 'wled-client';
import {_HSVtoRGB, hsvToRgb, rgbToHsv } from './utils.js';

class LightState {
  on = false;
  private hkBrightness = 100;     // 0-100
  hue = 0;                        // 0-360
  saturation = 0;                 // 0-100
  colors = [0, 0, 0];

  setWledBrightness(wledBrightness: number) {
    this.hkBrightness = LightState.toHkBrightness(wledBrightness);
  }

  getWledBrightness() {
    return LightState.toWledBrightness(this.hkBrightness);
  }

  setHkBrightness(hkBrightness: number) {
    this.hkBrightness = hkBrightness;
  }

  getHkBrightness() {
    return this.hkBrightness;
  }

  static toHkBrightness(wledBrightness: number) {
    return Math.round(wledBrightness * 100 / 255);
  }

  static toWledBrightness(hkBrightness: number) {
    return Math.round(hkBrightness * 255 / 100);
  }

}

export class WledAccessory {
  private lightService: Service;

  private lightStates: LightState = new LightState();

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
  async getOn(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get On ->', this.lightStates.on);

    return this.lightStates.on;
  }

  async getBrightness(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Brightness ->', this.lightStates.getHkBrightness());

    return this.lightStates.getHkBrightness();
  }

  async getHue(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Hue ->', this.lightStates.hue);

    return this.lightStates.hue;
  }

  async getSaturation(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Saturation ->', this.lightStates.saturation);

    return this.lightStates.saturation;
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

    try {
      await this.wledClient.setBrightness(LightState.toWledBrightness(value as number));
    } catch (error) {
      this.platform.log.error('Error setting Brightness', error);
    }
  }

  async setHue(value: CharacteristicValue) {
    this.platform.log.debug('Set Hue -> ', value);

    const { r, g, b } = _HSVtoRGB(
      value as number,
      this.lightStates.saturation,
      this.lightStates.getHkBrightness(),
    );

    this.platform.log.debug(`Set Hue Color -> RGB(${r}, ${g}, ${b})`);

    try {
      await this.wledClient.setColor([r, g, b]);
    } catch (error) {
      this.platform.log.error('Error setting Hue', error);
    }
  }

  async setSaturation(value: CharacteristicValue) {
    this.platform.log.debug('Set Saturation -> ', value);

    const { r, g, b } = _HSVtoRGB(
      this.lightStates.hue,
      value as number,
      this.lightStates.getHkBrightness(),
    );

    this.platform.log.debug(`Set Saturation Color -> RGB(${r}, ${g}, ${b})`);

    try {
      await this.wledClient.setColor([r, g, b]);
    } catch (error) {
      this.platform.log.error('Error setting Saturation', error);
    }
  }

  private onStateReceived() {
    const state = this.wledClient.state;

    // this.platform.log.debug('State received -> ', this.wledClient.state);
    this.platform.log.debug('------ State received');

    if (state.on != null && this.lightStates.on !== state.on) {
      this.lightStates.on = state.on;
      this.lightService.updateCharacteristic(this.platform.Characteristic.On, this.lightStates.on);
      this.platform.log.debug('Updated On Characteristic -> ', this.lightStates.on);
    }

    const colors = state.segments.at(0)?.colors?.at(0);
    if (colors != null && JSON.stringify(colors) !== JSON.stringify(this.lightStates.colors)) {
      const { h, s, v } = rgbToHsv(colors[0], colors[1], colors[2]);
      this.lightStates.colors = colors;
      this.lightStates.hue = h;
      this.lightStates.saturation = s;
      this.lightStates.setHkBrightness(v);
      this.lightService.updateCharacteristic(this.platform.Characteristic.Hue, this.lightStates.hue);
      this.lightService.updateCharacteristic(this.platform.Characteristic.Saturation, this.lightStates.saturation);
      this.lightService.updateCharacteristic(this.platform.Characteristic.Brightness, this.lightStates.getHkBrightness());
      this.platform.log.debug('Updated Color Characteristic -> ', {
        h: this.lightStates.hue,
        s: this.lightStates.saturation,
        v: this.lightStates.getHkBrightness(),
      });
    }

    if (state.brightness != null && this.lightStates.getWledBrightness() !== state.brightness) {
      this.lightStates.setWledBrightness(state.brightness);
      this.lightService.updateCharacteristic(this.platform.Characteristic.Brightness, this.lightStates.getHkBrightness());
      this.platform.log.debug('Updated Brightness Characteristic -> ', this.lightStates.getHkBrightness());
    }
  }
}
