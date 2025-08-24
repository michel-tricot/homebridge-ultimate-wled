<p align="center">
  <img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>

# Homebridge Ultimate WLED

[![npm](https://img.shields.io/npm/v/homebridge-ultimate-wled.svg)](https://www.npmjs.com/package/homebridge-ultimate-wled)
[![npm](https://img.shields.io/npm/dt/homebridge-ultimate-wled.svg)](https://www.npmjs.com/package/homebridge-ultimate-wled)

A comprehensive [Homebridge](https://homebridge.io) plugin for controlling [WLED](https://kno.wled.ge) LED strips through Apple HomeKit. This plugin provides advanced control features and seamless integration with your smart home ecosystem.

## Features

- 🎨 **Full RGB Control**: Change colors, brightness, and saturation through HomeKit
- 🔄 **Real-time State Sync**: Automatic synchronization with WLED device state
- 📱 **Multiple Device Support**: Control multiple WLED controllers from a single plugin
- ⚡ **High Performance**: Optimized for fast response times and minimal network overhead
- 🛡️ **Robust Error Handling**: Automatic reconnection and graceful error recovery

## Requirements

- [Homebridge](https://homebridge.io) v1.8.0 or later
- Node.js 18.20.4, 20.18.0, or 22.10.0+
- WLED device with firmware v0.13.x or later

## Installation

### Option 1: Homebridge UI (Recommended)
1. Search for `homebridge-ultimate-wled` in the Homebridge UI
2. Click **Install**
3. Configure the plugin through the UI

### Option 2: Command Line
```bash
npm install -g homebridge-ultimate-wled
```

## Configuration

### Basic Configuration

Add the following to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "Ultimate Wled",
      "wleds": [
        {
          "name": "Living Room Strip",
          "ip": "192.168.1.100"
        }
      ]
    }
  ]
}
```

### Multiple Devices

```json
{
  "platforms": [
    {
      "platform": "Ultimate Wled",
      "wleds": [
        {
          "name": "Living Room Strip",
          "ip": "192.168.1.100"
        },
        {
          "name": "Bedroom Strip",
          "ip": "192.168.1.101"
        },
        {
          "name": "Kitchen Under Cabinet",
          "ip": "192.168.1.102"
        }
      ]
    }
  ]
}
```

### Configuration Options

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | string | ✓ | Must be `"Ultimate Wled"` |
| `wleds` | array | ✓ | Array of WLED device configurations |
| `name` | string | ✓ | Display name for the device in HomeKit |
| `ip` | string | ✓ | IP address of WLED device |

## Usage

### Basic Controls
- **On/Off**: Toggle your WLED strip through the Home app
- **Brightness**: Adjust brightness from 0-100%
- **Color**: Choose any color from the HomeKit color picker

### Siri Integration
- *"Turn on Living Room Strip"*
- *"Set Living Room Strip to 50% brightness"*
- *"Set Living Room Strip to blue"*

## Troubleshooting

### Device Not Responding
1. Verify the WLED device IP address is correct
2. Ensure the device is on the same network as Homebridge
3. Check WLED firmware version (v0.13.x+ recommended)
4. Restart Homebridge after configuration changes

### Common Issues
- **Device shows as "No Response"**: Check network connectivity and IP address
- **Colors not working**: Ensure WLED is configured with RGB LEDs
- **Plugin not loading**: Verify configuration syntax in `config.json`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/michel-tricot/homebridge-ultimate-wled/issues)
- 💬 **Questions**: [Homebridge Discord](https://discord.gg/homebridge)
- 📖 **WLED Documentation**: [WLED Knowledge Base](https://kno.wled.ge)

## Acknowledgments

- Thanks to the [Homebridge](https://homebridge.io) team for the excellent platform
- Inspired by other WLED Homebridge plugins in the community
