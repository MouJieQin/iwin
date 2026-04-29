const wsServer = require("./websocket-server"); // 引入全局服务
global.wsServer = wsServer;

class WsMessageHandler {
    constructor() {
        this.wsServer = wsServer;
    }

    startWebSocketServer() {
        this.wsServer.start();
        // 监听服务事件 → 推送到界面
        this.wsServer.onClientConnected = (client) => {
            console.log("log", `✅ 连接：${client.path} (${client.id})`);
        };

        this.wsServer.onClientDisconnected = (client) => {
            console.log("log", `❌ 断开：${client.path}`);
        };

        this.wsServer.onMessageReceived = (client, msg) => {
            console.log("log", `📩 ${client.path}：${msg}`);
            // 处理来自websocket的消息
            this._handel_websocket_message(client, msg);
        };
    }

    _handel_websocket_message(client, msg) {
        switch (client.path) {
            case "/ws/voichai":
                this._handle_voichai_websocket_message(client, msg);
                break;
            case "/ws/mxdict":
                this._handle_mxdict_websocket_message(client, msg);
                break;
            default:
                console.warn("未知路径消息：", client.path);
        }
    }

    _handle_voichai_websocket_message = (client, msg) => {
        // 处理来自 voichai 的消息
        console.log("处理 voichai 消息：", msg);
        try {
            const message = JSON.parse(msg);
            switch (message.type) {
                case "toggle_floating_pin":
                    this._handle_voichai_toggle_floating_pin(message.data);
                    break;
                default:
                    break;
            }
        } catch (err) {
            console.error("解析 JSON 消息失败：", err);
        }
    };

    _handle_voichai_toggle_floating_pin(data) {
        const winId = "voichai-chat-" + data.session_id;
        const wsId = data.client_id;
        const session_id = data.session_id;
        const is_pinned = data.is_pinned;
        global.windowsManager.togglePinWindow(
            winId,
            wsId,
            session_id,
            is_pinned,
        );
    }

    _handle_mxdict_websocket_message = (client, msg) => {
        // 处理来自 mxdict 的消息
        console.log("处理 mxdict 消息：", msg);
        try {
            const message = JSON.parse(msg);
            switch (message.type) {
                case "toggle_floating_pin":
                    this._handle_mxdict_toggle_floating_pin(message.data);
                    break;
                default:
                    break;
            }
        } catch (err) {
            console.error("解析 JSON 消息失败：", err);
        }
    };

    _handle_mxdict_toggle_floating_pin(data) {
        const winId = "mxdict-dict-" + data.session_id;
        const wsId = data.client_id;
        const session_id = data.session_id;
        const is_pinned = data.is_pinned;
        global.windowsManager.togglePinWindow(
            winId,
            wsId,
            session_id,
            is_pinned,
        );
    }
}

// 导出单例（全局唯一，方便其他文件直接引入使用）
const wsMessageHandler = new WsMessageHandler();
module.exports = wsMessageHandler;
