module.exports = (api) => {
    api.registerAccessory('SmartSenseIndoor', IAQMPlugin);
}

class IAQMPlugin {

    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.name = config.name;

        this.log.debug('SmartSense Indoor Plugin loaded');

        this.informationService = new this.api.hap.Service.AccessoryInformation()
            .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "SmartSense")
            .setCharacteristic(this.api.hap.Characteristic.Model, "IAQM")
            .setCharacteristic(this.api.hap.Characteristic.SerialNumber, config.serial || "IAQM00000000");

        this.temperatureService = new this.Service.TemperatureSensor('T');
        this.temperatureService.getCharacteristic(this.Characteristic.CurrentTemperature).onGet(this.createHandler("sht40_temp").bind(this));

        this.humidityService = new this.Service.HumiditySensor('RH');
        this.humidityService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).onGet(this.createHandler("sht40_humi").bind(this));

        this.CO2service = new this.Service.CarbonDioxideSensor('CO2');
        this.CO2service.getCharacteristic(this.Characteristic.CarbonDioxideDetected).onGet(this.createHandler("co2_ok").bind(this));
        this.CO2service.getCharacteristic(this.Characteristic.CarbonDioxideLevel).onGet(this.createHandler("scd30_co2").bind(this));

        this.airqService = new this.Service.AirQualitySensor('PM');
        this.airqService.getCharacteristic(this.Characteristic.AirQuality).onGet(this.createHandler("aqi").bind(this));
        this.airqService.getCharacteristic(this.Characteristic.PM10Density).onGet(this.createHandler("sps30_pm10.0").bind(this));
        this.airqService.getCharacteristic(this.Characteristic.PM2_5Density).onGet(this.createHandler("sps30_pm2.5").bind(this));

        this.state = {
            "sht40_temp": 0.0,
            "sht40_humi": 0.0,
            "co2_ok": this.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL,
            "scd30_co2": 0.0,
            "aqi": this.Characteristic.AirQuality.UNKNOWN,
            "sps30_pm10.0": 0.0,
            "sps30_pm2.5": 0.0,
        };

        this.updateState().then(() => this.log.debug('State loaded'));
    }

    async updateState() {
        this.reload && clearTimeout(this.reload);
        const response = await fetch(this.config.url);
        if (!response.ok) {
            this.log.error('Bad response');
            return;
        }
        this.state = await response.json();
        this.state["co2_ok"] = this.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;
        this.state["aqi"] = this.Characteristic.AirQuality.GOOD;
        this.reload = setTimeout(() => {
            this.updateState().then(
                () => this.log.debug('State reloaded'),
                (err) => this.log.error('State reload failed', err)
            );
        }, this.config.reload * 1000);
    }

    getServices() {
        return [
            this.informationService,
            this.temperatureService,
            this.humidityService,
            this.CO2service,
            this.airqService,
        ];
    }

    createHandler(field) {
        return function () {
            this.log.debug(`Triggered GET ${field}`);
            return this.state[field];
        }
    }
}