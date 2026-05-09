import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createAdminClient } from "@maietek/db";
import { socketAuthMiddleware, type AuthenticatedSocket } from "./auth";
import { sendUserOnlineTelegramNotification } from "../services/notifications";
import { logger } from "../utils/logger";

/** Globální reference na Socket.IO server – importují ji route handlery pro broadcast */
let io: Server | null = null;

/** Map userId → Set<socketId> pro cílené broadcasty */
const userSockets = new Map<string, Set<string>>();
const lastOnlineByUserId = new Map<string, string | null>();
const supabaseAdmin = createAdminClient();

function getWebOrigin() {
  return (
    process.env.WEB_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL
  )?.replace(/\/+$/, "");
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO server ještě není inicializován");
  }
  return io;
}

/** Vrátí Set socket ID pro daného uživatele (nebo prázdný set) */
export function getUserSocketIds(userId: string): Set<string> {
  return userSockets.get(userId) || new Set();
}

/** Je uživatel online (má alespoň 1 aktivní socket)? */
export function isUserOnline(userId: string): boolean {
  const sockets = userSockets.get(userId);
  return !!sockets && sockets.size > 0;
}

function emitPresenceSync(socket: AuthenticatedSocket, userId: string) {
  const onlineUserIds = Array.from(userSockets.keys()).filter(
    (onlineUserId) => onlineUserId !== userId,
  );
  socket.emit("presence:sync", {
    onlineUserIds,
    lastOnlineByUserId: Object.fromEntries(
      onlineUserIds.map((onlineUserId) => [
        onlineUserId,
        lastOnlineByUserId.get(onlineUserId) ?? null,
      ]),
    ),
  });
}

async function updateLastOnlineAt(userId: string, value: string) {
  lastOnlineByUserId.set(userId, value);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ last_online_at: value })
    .eq("id", userId);

  if (error) {
    logger.error("Socket.IO last_online_at update failed", {
      userId,
      error,
    });
  }
}

export function initSocketIO(httpServer: HttpServer): Server {
  const webOrigin = getWebOrigin();

  io = new Server(httpServer, {
    cors: {
      ...(webOrigin ? { origin: webOrigin } : {}),
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Chat namespace
  const chatNs = io.of("/chat");

  // Auth middleware
  chatNs.use(socketAuthMiddleware);

  chatNs.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;
    const userName = socket.data.userName;
    const userRole = socket.data.userRole;
    const wasOffline = !isUserOnline(userId);

    // Register socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    const connectedAt = new Date().toISOString();
    void updateLastOnlineAt(userId, connectedAt);

    logger.info("Socket.IO user connected", {
      userId,
      userName,
      socketId: socket.id,
    });

    emitPresenceSync(socket, userId);

    // Broadcast online status
    socket.broadcast.emit("user:online", {
      userId,
      userName,
      lastOnlineAt: connectedAt,
    });

    if (wasOffline) {
      void sendUserOnlineTelegramNotification({ userId, userName, userRole });
    }

    // --- Chat events ---

    socket.on("presence:get", () => {
      emitPresenceSync(socket, userId);
    });

    socket.on("message:typing", () => {
      socket.broadcast.emit("message:typing", { userId, userName });
    });

    socket.on("message:stop-typing", () => {
      socket.broadcast.emit("message:stop-typing", { userId });
    });

    // --- Disconnect ---

    socket.on("disconnect", (reason) => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          const lastOnlineAt = new Date().toISOString();
          void updateLastOnlineAt(userId, lastOnlineAt);
          // Broadcast offline only when all tabs/devices disconnected
          socket.broadcast.emit("user:offline", { userId, lastOnlineAt });
        }
      }
      logger.info("Socket.IO user disconnected", {
        userId,
        userName,
        socketId: socket.id,
        reason,
      });
    });
  });

  logger.info("Socket.IO chat namespace initialized");

  return io;
}
