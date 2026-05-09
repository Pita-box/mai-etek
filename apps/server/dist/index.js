"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = require("http");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const superadmin_1 = __importDefault(require("./routes/superadmin"));
const user_1 = __importDefault(require("./routes/user"));
const chat_1 = __importDefault(require("./routes/chat"));
const socket_1 = require("./socket");
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
const port = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
app.use('/api/auth', auth_1.default);
app.use('/api/superadmin', superadmin_1.default);
app.use('/api/user', user_1.default);
app.use('/api/chat', chat_1.default);
// HTTP server + Socket.IO
const httpServer = (0, http_1.createServer)(app);
(0, socket_1.initSocketIO)(httpServer);
httpServer.listen(port, () => {
    logger_1.logger.info('Server started', { port });
});
