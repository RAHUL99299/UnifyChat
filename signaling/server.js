import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";

const PORT = Number(process.env.PORT || 4000);
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "*";
const HOST = process.env.HOST || "0.0.0.0";
const CALLEE_RECONNECT_GRACE_MS = 20000;

const ringingCalls = new Map();

const userRoom = (userId) => `user:${userId}`;

const findRingingCallByParticipants = (callerId, calleeId) => {
  for (const call of ringingCalls.values()) {
    if (call.status === "ringing" && call.from === callerId && call.to === calleeId) {
      return call;
    }
  }
  return null;
};

const clearDisconnectExpiry = (call) => {
  if (call?.disconnectExpireTimer) {
    clearTimeout(call.disconnectExpireTimer);
    call.disconnectExpireTimer = null;
  }
};

const expireCallAsUnavailable = (ioServer, call) => {
  if (!call || call.status !== "ringing") return;
  call.status = "ended";
  clearDisconnectExpiry(call);
  ringingCalls.delete(call.callId);
  ioServer.to(userRoom(call.from)).emit("call:reject", {
    to: call.from,
    from: call.to,
    reason: "unavailable",
    callId: call.callId,
  });
};

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  const userId = typeof socket.handshake.query.userId === "string"
    ? socket.handshake.query.userId
    : null;

  if (!userId) {
    socket.disconnect(true);
    return;
  }

  const room = userRoom(userId);
  socket.join(room);

  // If this user reconnects while a call is still ringing, re-deliver incoming call.
  for (const call of ringingCalls.values()) {
    if (call.status === "ringing" && call.to === userId) {
      clearDisconnectExpiry(call);
      io.to(room).emit("call:request", call.payload);
    }
  }

  socket.on("call:request", (payload) => {
    if (!payload?.to) return;

    const callId = payload.callId || randomUUID();
    const enrichedPayload = {
      ...payload,
      callId,
    };

    const targetRoom = io.sockets.adapter.rooms.get(userRoom(payload.to));
    if (!targetRoom || targetRoom.size === 0) {
      io.to(userRoom(payload.from)).emit("call:reject", {
        to: payload.from,
        from: payload.to,
        reason: "unavailable",
        callId,
      });
      return;
    }

    const callSession = {
      callId,
      from: payload.from,
      to: payload.to,
      status: "ringing",
      payload: enrichedPayload,
      disconnectExpireTimer: null,
    };
    ringingCalls.set(callId, callSession);

    io.to(userRoom(payload.to)).emit("call:request", enrichedPayload);
  });

  socket.on("call:accept", (payload) => {
    if (!payload?.to) return;

    const call = payload.callId
      ? ringingCalls.get(payload.callId)
      : findRingingCallByParticipants(payload.to, payload.from);

    if (call && call.status === "ringing") {
      call.status = "accepted";
      clearDisconnectExpiry(call);
      ringingCalls.delete(call.callId);
      io.to(userRoom(payload.to)).emit("call:accept", {
        ...payload,
        callId: call.callId,
      });
      return;
    }

    io.to(userRoom(payload.to)).emit("call:accept", payload);
  });

  socket.on("call:reject", (payload) => {
    if (!payload?.to) return;

    const call = payload.callId
      ? ringingCalls.get(payload.callId)
      : findRingingCallByParticipants(payload.to, payload.from);

    if (call && call.status === "ringing") {
      call.status = "ended";
      clearDisconnectExpiry(call);
      ringingCalls.delete(call.callId);
      io.to(userRoom(payload.to)).emit("call:reject", {
        ...payload,
        callId: call.callId,
      });
      return;
    }

    io.to(userRoom(payload.to)).emit("call:reject", payload);
  });

  socket.on("webrtc:offer", (payload) => {
    if (!payload?.to) return;
    io.to(`user:${payload.to}`).emit("webrtc:offer", payload);
  });

  socket.on("webrtc:answer", (payload) => {
    if (!payload?.to) return;
    io.to(`user:${payload.to}`).emit("webrtc:answer", payload);
  });

  socket.on("webrtc:ice-candidate", (payload) => {
    if (!payload?.to) return;
    io.to(`user:${payload.to}`).emit("webrtc:ice-candidate", payload);
  });

  socket.on("call:end", (payload) => {
    if (!payload?.to) return;

    const call = payload.callId
      ? ringingCalls.get(payload.callId)
      : findRingingCallByParticipants(payload.from, payload.to);

    if (call) {
      call.status = "ended";
      clearDisconnectExpiry(call);
      ringingCalls.delete(call.callId);
    }

    io.to(userRoom(payload.to)).emit("call:end", payload);
  });

  socket.on("disconnect", () => {
    // If callee disconnects while ringing, allow reconnection grace before ending call.
    for (const call of ringingCalls.values()) {
      if (call.status !== "ringing" || call.to !== userId) continue;
      if (call.disconnectExpireTimer) continue;

      call.disconnectExpireTimer = setTimeout(() => {
        expireCallAsUnavailable(io, call);
      }, CALLEE_RECONNECT_GRACE_MS);
    }
  });
});

httpServer.on("error", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
    console.error(`Signaling server is already running on port ${PORT}.`);
    console.error("Stop the existing process or reuse it instead of starting another instance.");
    process.exit(1);
  }

  console.error("Signaling server failed to start:", error);
  process.exit(1);
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Signaling server listening on http://${HOST}:${PORT}`);
});
