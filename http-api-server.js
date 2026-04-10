const http = require("http");

class HttpApiServer {
    constructor(port) {
        this.port = port;
        this.server = null;
        this.routes = {}; // 路由注册
    }

    // 启动服务
    start() {
        this.server = http.createServer((req, res) => {
            // 跨域支持
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");

            // 处理 OPTIONS 预检请求
            if (req.method === "OPTIONS") {
                res.writeHead(200);
                res.end();
                return;
            }

            // 只处理 POST + JSON
            if (
                req.method === "POST" &&
                req.headers["content-type"]?.includes("application/json")
            ) {
                let body = "";
                req.on("data", (chunk) => (body += chunk));
                req.on("end", () => {
                    try {
                        const json = JSON.parse(body);
                        const path = req.url;

                        // 触发对应路由回调
                        if (this.routes[path]) {
                            this.routes[path](json, (response) => {
                                res.writeHead(200, {
                                    "Content-Type": "application/json",
                                });
                                res.end(
                                    JSON.stringify(
                                        response || { success: true },
                                    ),
                                );
                            });
                        } else {
                            res.writeHead(404);
                            res.end(
                                JSON.stringify({
                                    success: false,
                                    msg: "路径不存在",
                                }),
                            );
                        }
                    } catch (e) {
                        res.writeHead(400);
                        res.end(
                            JSON.stringify({
                                success: false,
                                msg: "JSON 格式错误",
                            }),
                        );
                    }
                });
            } else {
                res.writeHead(405);
                res.end(
                    JSON.stringify({ success: false, msg: "仅支持 POST JSON" }),
                );
            }
        });

        this.server.listen(this.port, () => {
            console.log(
                `✅ Electron HTTP API 已启动：http://localhost:${this.port}`,
            );
        });
    }

    // 注册 POST 接口
    post(path, handler) {
        this.routes[path] = handler;
    }

    // 关闭服务
    close() {
        if (this.server) this.server.close();
    }
}

// 导出单例（全局共用）
const apiServer = new HttpApiServer(9797);
module.exports = apiServer;
