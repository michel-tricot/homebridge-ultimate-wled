import type { API, PlatformAccessory, PlatformConfig } from 'homebridge';
import { UltimateWled } from '../src/wledPlatform.js';
import { PLATFORM_NAME, PLUGIN_NAME } from '../src/settings.js';

// Mock the WledAccessory module
const mockInit = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/wledAccessory.js', () => ({
  WledAccessory: jest.fn().mockImplementation(() => ({
    init: mockInit,
  })),
}));

// Import the mocked constructor after the mock is defined
import { WledAccessory } from '../src/wledAccessory.js';
const MockedWledAccessory = WledAccessory as jest.MockedClass<typeof WledAccessory>;

describe('UltimateWled Platform', () => {
  let mockAPI: jest.Mocked<API>;
  let mockPlatformAccessory: jest.Mocked<PlatformAccessory>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHap: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockLog: any = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedWledAccessory.mockClear();
    mockInit.mockClear();

    mockPlatformAccessory = {
      displayName: 'Test WLED',
      UUID: 'test-uuid',
      context: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    mockHap = {
      uuid: {
        generate: jest.fn(() => 'generated-uuid'),
      },
    };

    mockAPI = {
      hap: mockHap,
      platformAccessory: jest.fn(() => mockPlatformAccessory),
      registerPlatformAccessories: jest.fn(),
      unregisterPlatformAccessories: jest.fn(),
      updatePlatformAccessories: jest.fn(),
      on: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('constructor', () => {
    it('should throw error when config is empty', () => {
      const config = {
        platform: 'Ultimate Wled',
      } as PlatformConfig;

      expect(() => {
        new UltimateWled(mockLog, config, mockAPI);
      }).toThrow('Empty config or missing wled configurations');
    });

    it('should throw error when wleds array is empty', () => {
      const config = {
        platform: 'Ultimate Wled',
        wleds: [],
      } as PlatformConfig;

      expect(() => {
        new UltimateWled(mockLog, config, mockAPI);
      }).toThrow('Empty config or missing wled configurations');
    });

    it('should throw error when WLED names are not unique', () => {
      const config = {
        platform: 'Ultimate Wled',
        wleds: [
          { name: 'Living Room', ip: '192.168.1.100' },
          { name: 'Living Room', ip: '192.168.1.101' },
        ],
      } as PlatformConfig;

      expect(() => {
        new UltimateWled(mockLog, config, mockAPI);
      }).toThrow('WLED names need to be different');
    });

    it('should initialize successfully with valid config', () => {
      const config = {
        platform: 'Ultimate Wled',
        wleds: [
          { name: 'Living Room', ip: '192.168.1.100' },
          { name: 'Bedroom', ip: '192.168.1.101' },
        ],
      } as PlatformConfig;

      new UltimateWled(mockLog, config, mockAPI);

      expect(mockAPI.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
    });
  });

  describe('configureAccessory', () => {
    it('should add accessory to cache', () => {
      const config = {
        platform: 'Ultimate Wled',
        wleds: [
          { name: 'Living Room', ip: '192.168.1.100' },
        ],
      } as PlatformConfig;

      const platform = new UltimateWled(mockLog, config, mockAPI);
      const mockAccessory = {
        displayName: 'Test Accessory',
        UUID: 'test-uuid',
      } as PlatformAccessory;

      platform.configureAccessory(mockAccessory);

      expect(platform.accessories.get('test-uuid')).toBe(mockAccessory);
    });
  });

  describe('discoverDevices', () => {
    let platform: UltimateWled;

    beforeEach(() => {
      const config = {
        platform: 'Ultimate Wled',
        wleds: [
          { name: 'Living Room', ip: '192.168.1.100' },
          { name: 'Bedroom', ip: '192.168.1.101' },
        ],
      } as PlatformConfig;

      mockHap.uuid.generate
        .mockReturnValue('default-uuid')
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      platform = new UltimateWled(mockLog, config, mockAPI);
    });

    it('should register new accessories', async () => {
      const mockAccessory1 = {
        displayName: 'Living Room',
        UUID: 'uuid-1',
        context: {},
      } as PlatformAccessory;

      const mockAccessory2 = {
        displayName: 'Bedroom',
        UUID: 'uuid-2',
        context: {},
      } as PlatformAccessory;

      mockAPI.platformAccessory
        .mockReturnValueOnce(mockAccessory1)
        .mockReturnValueOnce(mockAccessory2);

      await platform.discoverDevices();

      expect(mockHap.uuid.generate).toHaveBeenCalledTimes(2);
      expect(mockHap.uuid.generate).toHaveBeenNthCalledWith(1, 'homebridge:wled:Living Room');
      expect(mockHap.uuid.generate).toHaveBeenNthCalledWith(2, 'homebridge:wled:Bedroom');

      // Verify platformAccessory is called with the configs
      expect(mockAPI.platformAccessory).toHaveBeenCalledTimes(2);
      expect(mockAPI.platformAccessory).toHaveBeenCalledWith('Living Room', 'uuid-1');
      expect(mockAPI.platformAccessory).toHaveBeenCalledWith('Bedroom', 'uuid-2');

      // Verify registerPlatformAccessories is called with the actual returned objects
      expect(mockAPI.registerPlatformAccessories).toHaveBeenCalledTimes(2);
      expect(mockAPI.registerPlatformAccessories).toHaveBeenNthCalledWith(
        1,
        PLUGIN_NAME,
        PLATFORM_NAME,
        [mockAccessory1],
      );
      expect(mockAPI.registerPlatformAccessories).toHaveBeenNthCalledWith(
        2,
        PLUGIN_NAME,
        PLATFORM_NAME,
        [mockAccessory2],
      );

      // Verify accessory contexts are properly set
      expect(mockAccessory1.context.wled).toEqual({
        name: 'Living Room',
        ip: '192.168.1.100',
      });
      expect(mockAccessory2.context.wled).toEqual({
        name: 'Bedroom',
        ip: '192.168.1.101',
      });

      // Verify WledAccessory constructor and init are called
      expect(MockedWledAccessory).toHaveBeenCalledTimes(2);
      expect(mockInit).toHaveBeenCalledTimes(2);

      // Verify configuredAccessories is populated
      expect(platform.configuredAccessories.has('uuid-1')).toBe(true);
      expect(platform.configuredAccessories.has('uuid-2')).toBe(true);
      expect(platform.configuredAccessories.size).toBe(2);
    });

    it('should restore existing accessories from cache', async () => {
      const existingAccessory = {
        displayName: 'Living Room',
        UUID: 'uuid-1',
        context: {},
      } as PlatformAccessory;

      platform.accessories.set('uuid-1', existingAccessory);

      await platform.discoverDevices();

      // Verify updatePlatformAccessories has been called with existing accessories
      expect(mockAPI.updatePlatformAccessories).toHaveBeenCalledWith([existingAccessory]);

      // Verify WledAccessory is created for both accessories and init is called
      expect(MockedWledAccessory).toHaveBeenCalledTimes(2);
      expect(mockInit).toHaveBeenCalledTimes(2);

      // Verify configuredAccessories is populated
      expect(platform.configuredAccessories.has('uuid-1')).toBe(true);
      expect(platform.configuredAccessories.has('uuid-2')).toBe(true);
      expect(platform.configuredAccessories.size).toBe(2);
    });

    it('should remove unconfigured accessories', async () => {
      const unconfiguredAccessory = {
        displayName: 'Old Device',
        UUID: 'old-uuid',
      } as PlatformAccessory;

      platform.accessories.set('old-uuid', unconfiguredAccessory);
      mockHap.uuid.generate.mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2');

      await platform.discoverDevices();

      expect(mockAPI.unregisterPlatformAccessories).toHaveBeenCalledWith(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [unconfiguredAccessory],
      );

      // Verify WledAccessory is created for both new accessories and init is called
      expect(MockedWledAccessory).toHaveBeenCalledTimes(2);
      expect(mockInit).toHaveBeenCalledTimes(2);

      // Verify configuredAccessories contains both new accessories but not the old one
      expect(platform.configuredAccessories.has('uuid-1')).toBe(true);
      expect(platform.configuredAccessories.has('uuid-2')).toBe(true);
      expect(platform.configuredAccessories.has('old-uuid')).toBe(false);
      expect(platform.configuredAccessories.size).toBe(2);
    });
  });
});