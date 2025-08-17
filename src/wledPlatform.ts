import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import type {
  WLEDPluginConfiguration,
} from './@types/config';

import { WledAccessory } from './wledAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';


export class UltimateWled implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track accessories
  public readonly accessories = new Map<string, PlatformAccessory>();
  public readonly configuredAccessories = new Set<string>();

  private readonly pluginConfig: WLEDPluginConfiguration;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.pluginConfig = config as WLEDPluginConfiguration;

    if (this.pluginConfig == null || this.pluginConfig.wleds == null || this.pluginConfig.wleds.length === 0) {
      throw new Error('Empty config or missing wled configurations');
    }

    const wledNames = new Set<string>(this.pluginConfig.wleds.map(w => w.name));
    if (wledNames.size !== this.pluginConfig.wleds.length) {
      throw new Error('WLED names need to be different');
    }

    this.api.on('didFinishLaunching', () => {
      return this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.set(accessory.UUID, accessory);
  }

  async discoverDevices() {
    for (const wled of this.pluginConfig.wleds!) {
      const uuid = this.api.hap.uuid.generate('homebridge:wled:' + wled.name);

      this.log.debug(`Configuring wled (${uuid}):`, wled);

      let accessory = this.accessories.get(uuid);

      if (accessory) {
        this.log.info('Restoring existing accessory:', accessory.displayName);

        accessory.context.wled = wled;
        this.api.updatePlatformAccessories([accessory]);
      } else {
        this.log.info('Adding new accessory:', wled.name);

        accessory = new this.api.platformAccessory(wled.name, uuid);
        accessory.context.wled = wled;

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      const wledAccessory = new WledAccessory(this, accessory);
      await wledAccessory.init();

      this.configuredAccessories.add(uuid);
    }

    for (const [uuid, accessory] of this.accessories) {
      if (!this.configuredAccessories.has(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
