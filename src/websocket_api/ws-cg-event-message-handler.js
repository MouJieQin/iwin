const http = require("http");
const WebSocket = require("ws");

class WsCgEventMessageHandler {
    constructor() {
        this.wsClient = null;
        this.register = {};
    }

    // websocket
    async _retryWebsocketConnection() {
        let timer = setTimeout(async () => {
            clearTimeout(timer);
            if (this.wsClient.readyState !== WebSocket.OPEN) {
                try {
                    await this.webSocketManager();
                } catch (error) {
                    console.log("This could be an expected exception:", error);
                    return [];
                }
            }
        }, 5000);
    }

    regitserEventImple(eventType) {
        // 注册事件类型
        this.wsClient.send(
            JSON.stringify({
                type: "register_request",
                data: {
                    event: eventType,
                },
            }),
        );
    }

    // 注册事件
    registerEvent(registedId, eventType, callback) {
        if (
            !this.register[eventType] ||
            Object.keys(this.register[eventType]).length === 0
        ) {
            this.regitserEventImple(eventType);
            console.log("✅ 注册事件类型:", eventType);
            this.register[eventType] = {};
            // 注册事件回调
        }
        this.register[eventType][registedId] = callback;
    }

    // 注销事件
    unregisterEvent(registedId, eventType) {
        if (this.register[eventType]) {
            if (Object.keys(this.register[eventType]).length === 0) {
                return;
            }
            delete this.register[eventType][registedId];
            // 注销事件类型
            if (Object.keys(this.register[eventType]).length === 0) {
                this.wsClient.send(
                    JSON.stringify({
                        type: "unregister_request",
                        data: {
                            event: eventType,
                        },
                    }),
                );
                console.log("✅ 注销事件类型:", eventType);
            }
        }
    }

    registerAllEventAgainAfterReconnect() {
        for (const eventType in this.register) {
            this.regitserEventImple(eventType);
        }
    }

    async _handleMessage(message) {
        console.log("cg_event_handler message:", message);
        switch (message.type) {
            case "CGEvent":
                const cgEventType = message.data.type;
                for (const registedId in this.register[cgEventType]) {
                    await this.register[cgEventType][registedId](message.data);
                }
                break;
            case "update_theme":
                if (message.data.theme === "auto") {
                    nativeTheme.themeSource = "system";
                } else {
                    nativeTheme.themeSource = message.data.theme;
                }
                break;
            default:
                break;
        }
    }

    async webSocketManager() {
        try {
            const wsUrl = "ws://localhost:3195";
            const options = {
                rejectUnauthorized: false, // Bypass SSL certificate verification
            };
            const agent = new http.Agent(options);
            this.wsClient = new WebSocket(wsUrl, { agent });
            this.wsClient.onopen = () => {
                console.log("✅ 已连接 C++ WebSocket 服务");
                this.registerAllEventAgainAfterReconnect();
            };
            this.wsClient.onerror = (error) => {
                // console.error("WebSocket error:", error);
            };
            // webSocket.onopen = (event) => {};
            this.wsClient.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                console.log("message:", message);
                await this._handleMessage(message);
            };
            this.wsClient.onclose = async (event) => {
                await this._retryWebsocketConnection();
            };
        } catch (error) {
            // console.error("WebSocket error:", error);
            await this._retryWebsocketConnection();
        }
    }
}

// 导出单例（全局唯一，方便其他文件直接引入使用）
const wsCgEventMessageHandler = new WsCgEventMessageHandler();
module.exports = wsCgEventMessageHandler;
