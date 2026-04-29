const { warn } = require("console");
const { Tray, screen, Menu, BrowserWindow, nativeImage } = require("electron");
const path = require("path");
const appManager = require("../appManager/app-manager");

class TrayManager {
    constructor(tray, win) {
        this.tray = tray;
        this.win = win;
    }

    // 主窗口相关代码
    createWindow() {
        // 创建一个小窗口，点击托盘图标弹出
        this.win = new BrowserWindow({
            width: 300,
            height: 400,
            // 窗口样式：无边框、不显示任务栏、始终置顶
            frame: false,
            show: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
        });

        // 加载页面
        this.win.loadFile("index.html");

        // 点击窗口外部自动关闭
        this.win.on("blur", () => {
            this.win.hide();
        });
    }

    async createTray() {
        // 托盘图标（macOS 推荐使用 16x16、黑色透明图标）
        const iconPath = path.join(__dirname, "../../icon.png");
        this.tray = new Tray(iconPath);

        // 状态：用来动态切换图标
        this.voichaiTop = false;
        this.mxdictTop = false;

        // ==============================================
        // 动态构建菜单（可随时刷新）
        // ==============================================
        this.buildContextMenu = async () => {
            const isKeyboardRunning = await appManager.checkKeyboardRunning();
            const isMxdictRunning = await appManager.checkMxdictRunning();
            const isVoichaiRunning = await appManager.checkVoichaiRunning();

            return Menu.buildFromTemplate([
                {
                    label: "显示窗口",
                    click: () => {
                        this.win.show();
                    },
                },
                { type: "separator" },
                {
                    label: "keyboard",
                    icon: this.createElementIcon(
                        isKeyboardRunning ? "running" : "stopped",
                    ),
                    submenu: [
                        {
                            label: isKeyboardRunning ? "停止" : "启动",

                            click: async () => {
                                if (isKeyboardRunning) {
                                    await appManager.stopKeyboard();
                                } else {
                                    await appManager.launchKeyboard();
                                }
                                // handle_mxdict_toggle_top_window(data);
                                this.tray.setContextMenu(
                                    await this.buildContextMenu(),
                                );
                                return false; // 👈 不消失
                            },
                        },
                    ],
                },

                { type: "separator" },

                {
                    label: "voichai",
                    icon: this.createElementIcon(
                        isVoichaiRunning ? "running" : "stopped",
                    ),
                },

                { type: "separator" },
                {
                    label: "mxdict",
                    icon: this.createElementIcon(
                        isMxdictRunning ? "running" : "stopped",
                    ),
                },

                { type: "separator" },
                {
                    label: "退出",
                    click: () => global.app.quit(),
                },
            ]);
        };

        // ==============================================
        // 核心工具：把 Element 图标 SVG 转成托盘图标
        // ==============================================
        this.createElementIcon = (type) => {
            const icons = {
                running: path.join(__dirname, "../../assets/icons/running.png"),
                stopped: path.join(__dirname, "../../assets/icons/stopped.png"),
                warning: path.join(__dirname, "../../assets/icons/warning.png"),
            };

            return nativeImage.createFromPath(icons[type]);
        };

        this.tray.setToolTip("我的 Electron 菜单栏应用");
        this.tray.setContextMenu(await this.buildContextMenu());

        // 点击托盘图标切换窗口显示/隐藏
        this.tray.on("click", async () => {
            this.tray.setContextMenu(await this.buildContextMenu());
            // if (this.win.isVisible()) {
            //     this.win.hide();
            // } else {
            //     // 让窗口显示在托盘图标正下方
            //     const trayBounds = this.tray.getBounds();
            //     const windowBounds = this.win.getBounds();

            //     const x = Math.round(
            //         trayBounds.x +
            //             trayBounds.width / 2 -
            //             windowBounds.width / 2,
            //     );
            //     const y = Math.round(trayBounds.y + trayBounds.height);

            //     this.win.setPosition(x, y);
            //     this.win.show();
            // }
        });
    }
}

let tray;
let win;

// 导出单例（全局唯一，方便其他文件直接引入使用）
const trayManager = new TrayManager(tray, win);
module.exports = trayManager;
