import type { PlatformAccessory, Service } from 'homebridge';
import { WledAccessory } from '../src/wledAccessory.js';
import { PLATFORM_NAME, PLUGIN_AUTHOR } from '../src/settings.js';
import type { UltimateWled } from '../src/wledPlatform.js';
import type { WLEDConfiguration } from '../src/@types/config';

// Mock color-convert module
jest.mock('color-convert', () => ({
  __esModule: true,
  default: {
    rgb: { hsv: jest.fn().mockReturnValue([0, 0, 100]) },
    hsv: { rgb: jest.fn().mockReturnValue([255, 255, 255]) },
  },
}));

// Mock the WLEDClient module
const mockWLEDClientOn = jest.fn();
const mockWLEDClientInit = jest.fn().mockResolvedValue(undefined);
const mockWLEDClientTurnOn = jest.fn().mockResolvedValue(undefined);
const mockWLEDClientTurnOff = jest.fn().mockResolvedValue(undefined);
const mockWLEDClientSetBrightness = jest.fn().mockResolvedValue(undefined);
const mockWLEDClientSetColor = jest.fn().mockResolvedValue(undefined);
const mockWLEDClientSetPreset = jest.fn().mockResolvedValue(undefined);

const mockWLEDClientRefreshPresets = jest.fn().mockResolvedValue(undefined);

const mockWLEDClient = {
  on: mockWLEDClientOn,
  init: mockWLEDClientInit,
  turnOn: mockWLEDClientTurnOn,
  turnOff: mockWLEDClientTurnOff,
  setBrightness: mockWLEDClientSetBrightness,
  setColor: mockWLEDClientSetColor,
  setPreset: mockWLEDClientSetPreset,
  refreshPresets: mockWLEDClientRefreshPresets,
  info: { version: '0.14.0' },
  state: {},
  presets: {},
};

jest.mock('wled-client', () => ({
  WLEDClient: jest.fn().mockImplementation(() => mockWLEDClient),
}));

import { WLEDClient } from 'wled-client';
const MockedWLEDClient = WLEDClient as jest.MockedClass<typeof WLEDClient>;

describe('WledAccessory', () => {
  let mockPlatform: jest.Mocked<UltimateWled>;
  let mockAccessory: jest.Mocked<PlatformAccessory>;
  let mockLightService: jest.Mocked<Service>;
  let mockAccessoryInfoService: jest.Mocked<Service>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCharacteristic: jest.Mocked<any>;
  let wledAccessory: WledAccessory;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockLog: any = {
    debug: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock characteristic
    mockCharacteristic = {
      onSet: jest.fn().mockReturnThis(),
      onGet: jest.fn().mockReturnThis(),
      setCharacteristic: jest.fn().mockReturnThis(),
      updateCharacteristic: jest.fn().mockReturnThis(),
    };

    // Mock services
    mockAccessoryInfoService = {
      setCharacteristic: jest.fn().mockReturnThis(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    mockLightService = {
      setCharacteristic: jest.fn().mockReturnThis(),
      getCharacteristic: jest.fn().mockReturnValue(mockCharacteristic),
      setPrimaryService: jest.fn().mockReturnThis(),
      updateCharacteristic: jest.fn().mockReturnThis(),
      testCharacteristic: jest.fn().mockReturnValue(false),
      addOptionalCharacteristic: jest.fn(),
      linkedServices: [],
      addLinkedService: jest.fn(),
      removeLinkedService: jest.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Mock accessory
    mockAccessory = {
      displayName: 'Test WLED',
      UUID: 'test-uuid',
      context: {
        wled: {
          name: 'Test Strip',
          ip: '192.168.1.100',
        } as WLEDConfiguration,
      },
      getService: jest.fn().mockImplementation((serviceType) => {
        if (serviceType === 'AccessoryInformation') {
          return mockAccessoryInfoService;
        }
        return undefined;
      }),
      getServiceById: jest.fn().mockImplementation((serviceType, subtype) => {
        if (serviceType === 'Lightbulb' && subtype === 'strip-main') {
          return mockLightService;
        }
        return undefined;
      }),
      addService: jest.fn().mockReturnValue(mockLightService),
      removeService: jest.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Mock platform
    mockPlatform = {
      log: mockLog,
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        Lightbulb: 'Lightbulb',
        Switch: 'Switch',
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        FirmwareRevision: 'FirmwareRevision',
        Name: 'Name',
        On: 'On',
        Brightness: 'Brightness',
        Hue: 'Hue',
        Saturation: 'Saturation',
        ConfiguredName: 'ConfiguredName',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('constructor', () => {
    it('should configure accessory with all required services and characteristics', () => {
      wledAccessory = new WledAccessory(mockPlatform, mockAccessory);

      // Accessory information
      expect(mockAccessory.getService).toHaveBeenCalledWith('AccessoryInformation');
      expect(mockAccessoryInfoService.setCharacteristic).toHaveBeenCalledWith('Manufacturer', PLATFORM_NAME);
      expect(mockAccessoryInfoService.setCharacteristic).toHaveBeenCalledWith('Model', PLUGIN_AUTHOR);
      expect(mockAccessoryInfoService.setCharacteristic).toHaveBeenCalledWith('SerialNumber', 'NA');
      expect(mockAccessoryInfoService.setCharacteristic).toHaveBeenCalledWith('FirmwareRevision', '0.14.0');
      expect(mockAccessoryInfoService.setCharacteristic).toHaveBeenCalledWith('Name', 'Test Strip');

      // Lightbulb service setup
      expect(mockAccessory.getServiceById).toHaveBeenCalledWith('Lightbulb', 'strip-main');
      expect(mockLightService.setCharacteristic).toHaveBeenCalledWith('Name', 'Light');
      expect(mockLightService.setPrimaryService).toHaveBeenCalledWith(true);

      // Characteristics configuration
      expect(mockLightService.getCharacteristic).toHaveBeenCalledWith('On');
      expect(mockLightService.getCharacteristic).toHaveBeenCalledWith('Brightness');
      expect(mockLightService.getCharacteristic).toHaveBeenCalledWith('Hue');
      expect(mockLightService.getCharacteristic).toHaveBeenCalledWith('Saturation');
      expect(mockCharacteristic.onSet).toHaveBeenCalledTimes(4);
      expect(mockCharacteristic.onGet).toHaveBeenCalledTimes(4);

      // WLED Client creation
      expect(MockedWLEDClient).toHaveBeenCalledWith({
        host: '192.168.1.100',
        websocket: {
          reconnect: true,
        },
        immediate: true,
      });
    });

    it('should add lightbulb service if it does not exist', () => {
      mockAccessory.getServiceById.mockReturnValue(undefined);

      wledAccessory = new WledAccessory(mockPlatform, mockAccessory);

      expect(mockAccessory.addService).toHaveBeenCalledWith('Lightbulb', 'Light', 'strip-main');
      expect(mockLightService.setCharacteristic).toHaveBeenCalledWith('Name', 'Light');
    });
  });

  describe('init', () => {
    beforeEach(() => {
      wledAccessory = new WledAccessory(mockPlatform, mockAccessory);
    });

    it('should register WLED client event listeners', async () => {
      await wledAccessory.init();

      expect(mockWLEDClientOn).toHaveBeenCalledTimes(4);
      expect(mockWLEDClientOn).toHaveBeenCalledWith('update:state', expect.any(Function));
      expect(mockWLEDClientOn).toHaveBeenCalledWith('update:presets', expect.any(Function));
      expect(mockWLEDClientOn).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWLEDClientOn).toHaveBeenCalledWith('close', expect.any(Function));

      expect(mockWLEDClientInit).toHaveBeenCalledTimes(1);
    });

    it('should refresh presets after init', async () => {
      await wledAccessory.init();

      expect(mockWLEDClientRefreshPresets).toHaveBeenCalledTimes(1);
    });

    it('should register open event handler that logs connection opened', async () => {
      await wledAccessory.init();

      // Get the open event handler and call it
      const openHandler = mockWLEDClientOn.mock.calls.find(call => call[0] === 'open')?.[1];
      expect(openHandler).toBeDefined();

      openHandler();
      expect(mockLog.debug).toHaveBeenCalledWith('✅ - Connection has been opened');
    });

    it('should register close event handler that logs connection closed', async () => {
      await wledAccessory.init();

      // Get the close event handler and call it
      const closeHandler = mockWLEDClientOn.mock.calls.find(call => call[0] === 'close')?.[1];
      expect(closeHandler).toBeDefined();

      closeHandler();
      expect(mockLog.debug).toHaveBeenCalledWith('❌ - Connection has been closed');
    });

    it('should register update:state event handler that calls onStateReceived', async () => {
      // Spy on the onStateReceived method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onStateReceivedSpy = jest.spyOn(wledAccessory as any, 'onStateReceived').mockImplementation(() => {});

      await wledAccessory.init();

      // Get the update:state event handler and call it
      const stateHandler = mockWLEDClientOn.mock.calls.find(call => call[0] === 'update:state')?.[1];
      expect(stateHandler).toBeDefined();

      stateHandler();
      expect(onStateReceivedSpy).toHaveBeenCalledTimes(1);
    });

    it('should register update:presets event handler that calls onPresetsReceived', async () => {
      // Spy on the onPresetsReceived method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onPresetsReceivedSpy = jest.spyOn(wledAccessory as any, 'onPresetsReceived').mockImplementation(() => {});

      await wledAccessory.init();

      // Get the update:presets event handler and call it
      const presetsHandler = mockWLEDClientOn.mock.calls.find(call => call[0] === 'update:presets')?.[1];
      expect(presetsHandler).toBeDefined();

      presetsHandler();
      expect(onPresetsReceivedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Getter Methods', () => {
    beforeEach(() => {
      wledAccessory = new WledAccessory(mockPlatform, mockAccessory);
    });

    it('should return current on state', async () => {
      // Set internal state
      wledAccessory.wledStates.on = true;

      const result = await wledAccessory.getOn();
      expect(result).toBe(true);
    });

    it('should return current brightness', async () => {
      // Set internal state
      wledAccessory.wledStates.hkBrightness = 75;

      const result = await wledAccessory.getBrightness();
      expect(result).toBe(75);
    });

    it('should return current hue', async () => {
      // Set internal state
      wledAccessory.wledStates.hsv = [120, 50, 75];

      const result = await wledAccessory.getHue();
      expect(result).toBe(120);
    });

    it('should return current saturation', async () => {
      // Set internal state
      wledAccessory.wledStates.hsv = [120, 80, 75];

      const result = await wledAccessory.getSaturation();
      expect(result).toBe(80);
    });

    it('should return true when on and preset matches current preset', async () => {
      // Set internal state
      wledAccessory.wledStates.on = true;
      wledAccessory.wledStates.currentPreset = 5;

      const result = await wledAccessory.getPresetOn(5);
      expect(result).toBe(true);
    });

    it('should return false when preset does not match current preset', async () => {
      // Set internal state
      wledAccessory.wledStates.on = true;
      wledAccessory.wledStates.currentPreset = 5;

      const result = await wledAccessory.getPresetOn(3);
      expect(result).toBe(false);
    });

    it('should return false when off even if preset matches', async () => {
      // Set internal state
      wledAccessory.wledStates.on = false;
      wledAccessory.wledStates.currentPreset = 5;

      const result = await wledAccessory.getPresetOn(5);
      expect(result).toBe(false);
    });
  });

  describe('Setter Methods', () => {
    beforeEach(() => {
      wledAccessory = new WledAccessory(mockPlatform, mockAccessory);
      jest.clearAllMocks();
    });

    describe('setOn', () => {
      it('should turn on WLED client when value is true', async () => {
        await wledAccessory.setOn(true);
        expect(mockWLEDClientTurnOn).toHaveBeenCalledTimes(1);
        expect(mockWLEDClientTurnOff).not.toHaveBeenCalled();
      });

      it('should turn off WLED client when value is false', async () => {
        await wledAccessory.setOn(false);
        expect(mockWLEDClientTurnOff).toHaveBeenCalledTimes(1);
        expect(mockWLEDClientTurnOn).not.toHaveBeenCalled();
      });
    });

    describe('setBrightness', () => {
      it('should update internal state and call WLED client setBrightness', async () => {
        await wledAccessory.setBrightness(80);

        // Check internal state was updated
        expect(wledAccessory.wledStates.hkBrightness).toBe(80);

        // Check WLED client was called with converted brightness (80% = 204/255)
        expect(mockWLEDClientSetBrightness).toHaveBeenCalledWith(204);
      });
    });

    describe('setHue', () => {
      it('should update internal state and call WLED client setColor', async () => {
        // Set initial state
        wledAccessory.wledStates.hsv = [0, 50, 0];
        wledAccessory.wledStates.hkBrightness = 75;

        await wledAccessory.setHue(240);

        // Check internal state was updated
        expect(wledAccessory.wledStates.hsv[0]).toBe(240);

        // Check WLED client was called with RGB values
        expect(mockWLEDClientSetColor).toHaveBeenCalledWith([255, 255, 255]);
      });
    });

    describe('setSaturation', () => {
      it('should update internal state and call WLED client setColor', async () => {
        // Set initial state
        wledAccessory.wledStates.hsv = [120, 0, 0];
        wledAccessory.wledStates.hkBrightness = 60;

        await wledAccessory.setSaturation(90);

        // Check internal state was updated
        expect(wledAccessory.wledStates.hsv[1]).toBe(90);

        // Check WLED client was called with RGB values
        expect(mockWLEDClientSetColor).toHaveBeenCalledWith([255, 255, 255]);
      });
    });

    describe('setPresetOn', () => {
      it('should set preset and turn on when value is true', async () => {
        await wledAccessory.setPresetOn(7, true);

        // Check internal state was updated
        expect(wledAccessory.wledStates.currentPreset).toBe(7);

        // Check WLED client was called (setPreset then turnOn)
        expect(mockWLEDClientSetPreset).toHaveBeenCalledWith(7);
        expect(mockWLEDClientTurnOn).toHaveBeenCalledTimes(1);
      });

      it('should turn off when value is false', async () => {
        await wledAccessory.setPresetOn(7, false);

        // Check WLED client was called to turn off
        expect(mockWLEDClientTurnOff).toHaveBeenCalledTimes(1);
      });
    });
  });
});