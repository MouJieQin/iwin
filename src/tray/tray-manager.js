const { Tray, screen, Menu, BrowserWindow } = require("electron");
const path = require("path");

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

    createTray() {
        // 托盘图标（macOS 推荐使用 16x16、黑色透明图标）
        const iconPath = path.join(__dirname, "../../icon.png");
        this.tray = new Tray(iconPath);

        // 托盘菜单
        const contextMenu = Menu.buildFromTemplate([
            { label: "显示窗口", click: () => win.show() },
            { type: "separator" },
            {
                label: "voichai",
                submenu: [
                    {
                        label: "切换窗口",
                        click: () => handle_voichai_toggle_top_window(data),
                    },
                    {
                        label: "显示窗口",
                        click: () => handle_voichai_show_top_window(data),
                    },
                ],
            },
            { type: "separator" },
            {
                label: "mxdict",
                submenu: [
                    {
                        label: "切换窗口",
                        click: () => handle_mxdict_toggle_top_window(data),
                    },
                    {
                        label: "显示窗口",
                        click: () => handle_mxdict_show_top_window(data),
                    },
                ],
            },
            { label: "退出", click: () => app.quit() },
        ]);

        this.tray.setToolTip("我的 Electron 菜单栏应用");
        this.tray.setContextMenu(contextMenu);

        // 点击托盘图标切换窗口显示/隐藏
        this.tray.on("click", () => {
            if (this.win.isVisible()) {
                this.win.hide();
            } else {
                // 让窗口显示在托盘图标正下方
                const trayBounds = this.tray.getBounds();
                const windowBounds = this.win.getBounds();

                const x = Math.round(
                    trayBounds.x +
                        trayBounds.width / 2 -
                        windowBounds.width / 2,
                );
                const y = Math.round(trayBounds.y + trayBounds.height);

                this.win.setPosition(x, y);
                this.win.show();
            }
        });
    }
}

let tray;
let win;

// 导出单例（全局唯一，方便其他文件直接引入使用）
const trayManager = new TrayManager(tray, win);
module.exports = trayManager;
