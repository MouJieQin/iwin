const http = require("http");

class HttpApiServer {
    constructor(port) {
        this.port = port;
        this.server = null;
        this.routes = {};
    }

    start() {
        this.server = http.createServer(async (req, res) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");

            if (req.method === "OPTIONS") {
                res.writeHead(200);
                res.end();
                return;
            }

            if (
                req.method === "POST" &&
                req.headers["content-type"]?.includes("application/json")
            ) {
                let body = "";
                req.on("data", (chunk) => (body += chunk));
                req.on("end", async () => {
                    try {
                        const json = JSON.parse(body);
                        const path = req.url;

                        if (this.routes[path]) {
                            // 🔥 这里支持 async 了
                            await this.routes[path](json, (response) => {
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
                                msg: "JSON 格式错误：" + e.message,
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
                `✅ Electron API 服务已启动：http://localhost:${this.port}`,
            );
        });
    }

    post(path, handler) {
        this.routes[path] = handler;
    }

    close() {
        if (this.server) this.server.close();
    }
}

const apiServer = new HttpApiServer(9797);
module.exports = apiServer;
