const path = require("path");
const fs = require("fs");
const { app } = require("electron");

class ConfigManager {
    config = {};
    constructor() {
        const splices = __dirname.split("/");
        this.rootPath = splices.splice(0, splices.length - 2).join("/");
        this.rootConfigPath = path.join(this.rootPath, "config.json");
        this.useDataPath = app.getPath("userData");
        this.appDataPath = path.join(this.useDataPath, "iWin-Store");
        this.configDir = path.join(this.appDataPath, "config");
        this.configWindowsDir = path.join(this.configDir, "windows");
        fs.mkdirSync(this.configWindowsDir, { recursive: true });
        this.configPath = path.join(this.configDir, "config.json");
        this._setupConfig();
    }

    getWindowConfigPath(windowId) {
        return path.join(this.configWindowsDir, windowId + ".json");
    }

    getWindowConfig(windowId) {
        try {
            const configPath = this.getWindowConfigPath(windowId);
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, "utf8");
                return JSON.parse(data);
            } else {
                return {};
            }
        } catch (error) {
            console.error("读取配置文件失败:", error);
            return {};
        }
    }

    saveWindowConfig(windowId, config) {
        const configPath = this.getWindowConfigPath(windowId);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    // set the default value recursively to the config if it that's in the root config file is not in the config file, but don't override the value if it's already set
    _setDefaultValueRecursively(obj, defaultValue) {
        for (const key in defaultValue) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === "object" && obj[key] !== null) {
                    this._setDefaultValueRecursively(
                        obj[key],
                        defaultValue[key],
                    );
                } else {
                    obj[key] = defaultValue[key];
                }
            }
        }
    }
    _setupConfig() {
        this.rootConfig = JSON.parse(
            fs.readFileSync(this.rootConfigPath, "utf-8"),
        );
        this.config = {};
        if (!fs.existsSync(this.configPath)) {
            fs.writeFileSync(
                this.configPath,
                JSON.stringify(this.rootConfig, null, 2),
            );
            this.config = this.rootConfig;
            return;
        } else {
            this.config = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
            this._setDefaultValueRecursively(this.config, this.rootConfig);
        }
    }
}

const configManager = new ConfigManager();
module.exports = configManager;
