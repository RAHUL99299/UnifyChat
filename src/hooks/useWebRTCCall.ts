import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/contexts/AuthContext";

export type CallType = "audio" | "video";
export type CallPhase = "idle" | "calling" | "incoming" | "connecting" | "in-call";

interface IncomingCallPayload {
  from: string;
  to: string;
  callType: CallType;
  conversationId?: string;
  callerName?: string;
  callerAvatar?: string;
  callerAvatarUrl?: string;
}

interface StartCallOptions {
  toUserId: string;
  callType: CallType;
  conversationId?: string;
  targetName?: string;
  targetAvatar?: string;
  targetAvatarUrl?: string;
  callerAvatarUrl?: string;
}

interface RemoteProfile {
  name: string;
  avatarInitials: string;
  avatarUrl: string | null;
}

interface CallDiagnostics {
  localAudioTracks: number;
  localAudioEnabled: boolean;
  remoteAudioTracks: number;
  remoteAudioEnabled: boolean;
  localInputLevel: number;
  packetsSent: number;
  packetsReceived: number;
  currentRttMs: number;
  iceState: RTCIceConnectionState;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const DEFAULT_SIGNALING_URL = `${window.location.protocol}//${window.location.hostname}:4000`;
const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || DEFAULT_SIGNALING_URL;
const SIGNALING_DISCONNECT_GRACE_MS = 5000;
const INCOMING_CALL_EXPIRE_MS = 30000;

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

export function useWebRTCCall() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerUserIdRef = useRef<string | null>(null);
  const currentCallTypeRef = useRef<CallType>("audio");
  const callPhaseRef = useRef<CallPhase>("idle");
  const incomingCallRef = useRef<IncomingCallPayload | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);
  const incomingExpireTimerRef = useRef<number | null>(null);
  const statusClearTimerRef = useRef<number | null>(null);
  const pendingAcceptRef = useRef<{
    to: string;
    from: string;
    callType: CallType;
    conversationId?: string;
  } | null>(null);

  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callType, setCallType] = useState<CallType>("audio");
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [remoteProfile, setRemoteProfile] = useState<RemoteProfile | null>(null);
  const [statusText, setStatusText] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [diagnostics, setDiagnostics] = useState<CallDiagnostics>({
    localAudioTracks: 0,
    localAudioEnabled: false,
    remoteAudioTracks: 0,
    remoteAudioEnabled: false,
    localInputLevel: 0,
    packetsSent: 0,
    packetsReceived: 0,
    currentRttMs: 0,
    iceState: "new",
  });

  const setCallPhaseSafe = useCallback((phase: CallPhase) => {
    callPhaseRef.current = phase;
    setCallPhase(phase);
  }, []);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const cleanupCallState = useCallback(() => {
    if (statusClearTimerRef.current) {
      window.clearTimeout(statusClearTimerRef.current);
      statusClearTimerRef.current = null;
    }

    const currentPeer = peerConnectionRef.current;
    if (currentPeer) {
      currentPeer.ontrack = null;
      currentPeer.onicecandidate = null;
      currentPeer.onconnectionstatechange = null;
      currentPeer.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (incomingExpireTimerRef.current) {
      window.clearTimeout(incomingExpireTimerRef.current);
      incomingExpireTimerRef.current = null;
    }

    peerUserIdRef.current = null;
    incomingCallRef.current = null;
    pendingAcceptRef.current = null;
    setIncomingCall(null);
    setCallPhaseSafe("idle");
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("new");
    setStatusText("");
    setDurationSeconds(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setDiagnostics({
      localAudioTracks: 0,
      localAudioEnabled: false,
      remoteAudioTracks: 0,
      remoteAudioEnabled: false,
      localInputLevel: 0,
      packetsSent: 0,
      packetsReceived: 0,
      currentRttMs: 0,
      iceState: "new",
    });
  }, [setCallPhaseSafe]);

  const ensurePeerConnection = useCallback((targetUserId: string) => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peer = new RTCPeerConnection(RTC_CONFIG);

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
        return;
      }

      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      remoteStreamRef.current.addTrack(event.track);
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current || !user) return;
      socketRef.current.emit("webrtc:ice-candidate", {
        to: targetUserId,
        from: user.id,
        candidate: event.candidate,
      });
    };

    peer.onconnectionstatechange = () => {
      const nextState = peer.connectionState;
      setConnectionState(nextState);

      if (nextState === "connected") {
        setCallPhaseSafe("in-call");
        setStatusText("Connected");
        if (statusClearTimerRef.current) {
          window.clearTimeout(statusClearTimerRef.current);
        }
        statusClearTimerRef.current = window.setTimeout(() => {
          if (peerConnectionRef.current?.connectionState === "connected") {
            setStatusText("");
          }
        }, 1800);
      }

      if (nextState === "disconnected") {
        setStatusText("Connection unstable. Reconnecting media...");
        setCallPhaseSafe("connecting");
        try {
          peer.restartIce();
        } catch {
          // Ignore unsupported restartIce implementations.
        }
        return;
      }

      if (nextState === "failed" || nextState === "closed") {
        setStatusText("Connection lost. Waiting to recover or end call.");
        setCallPhaseSafe("connecting");
        try {
          peer.restartIce();
        } catch {
          // Ignore unsupported restartIce implementations.
        }
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current as MediaStream);
      });
    }

    peerConnectionRef.current = peer;
    return peer;
  }, [setCallPhaseSafe, user]);

  const getMedia = useCallback(async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    setCallType(type);
    currentCallTypeRef.current = type;

    if (peerConnectionRef.current) {
      const senders = peerConnectionRef.current.getSenders();
      stream.getTracks().forEach((track) => {
        const alreadySending = senders.some((sender) => sender.track?.id === track.id);
        if (!alreadySending) {
          peerConnectionRef.current?.addTrack(track, stream);
        }
      });
    }

    return stream;
  }, []);

  const createAndSendOffer = useCallback(async () => {
    const targetUserId = peerUserIdRef.current;
    const socket = socketRef.current;
    if (!targetUserId || !socket || !user) return;

    const peer = ensurePeerConnection(targetUserId);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("webrtc:offer", {
      to: targetUserId,
      from: user.id,
      callType: currentCallTypeRef.current,
      sdp: offer,
    });

    setStatusText("Ringing...");
  }, [ensurePeerConnection, user]);

  const startCall = useCallback(async ({ toUserId, callType: type, conversationId, targetName, targetAvatar, targetAvatarUrl, callerAvatarUrl }: StartCallOptions) => {
    if (!socketRef.current || !user) return;
    if (!socketRef.current.connected) {
      socketRef.current.connect();
      setStatusText("Reconnecting signaling... tap call again");
      return;
    }
    if (!isSignalingConnected) {
      setStatusText("Signaling disconnected. Please reconnect and try again.");
      return;
    }
    if (toUserId === user.id) {
      setStatusText("Cannot call yourself");
      return;
    }

    try {
      cleanupCallState();
      await getMedia(type);

      peerUserIdRef.current = toUserId;
      setRemoteProfile({
        name: targetName || "User",
        avatarInitials: targetAvatar || getInitials(targetName || "User"),
        avatarUrl: targetAvatarUrl || null,
      });

      setCallPhaseSafe("calling");
      setStatusText("Calling...");

      socketRef.current.emit("call:request", {
        to: toUserId,
        from: user.id,
        callType: type,
        conversationId,
        callerName: user.user_metadata?.display_name || user.email || "User",
        callerAvatar: getInitials(user.user_metadata?.display_name || user.email || "User"),
        callerAvatarUrl: callerAvatarUrl || null,
      });
    } catch (error) {
      console.error("Failed to start call:", error);
      setStatusText("Unable to access microphone/camera");
      setCallPhaseSafe("idle");
      cleanupCallState();
    }
  }, [cleanupCallState, getMedia, isSignalingConnected, setCallPhaseSafe, user]);

  const rejectIncomingCall = useCallback(() => {
    if (!socketRef.current || !incomingCallRef.current || !user) {
      incomingCallRef.current = null;
      setIncomingCall(null);
      setCallPhaseSafe("idle");
      return;
    }

    if (!socketRef.current.connected) {
      socketRef.current.connect();
      setStatusText("Reconnecting signaling... tap Accept again");
      return;
    }

    socketRef.current.emit("call:reject", {
      to: incomingCallRef.current.from,
      from: user.id,
      reason: "rejected",
    });

    if (incomingExpireTimerRef.current) {
      window.clearTimeout(incomingExpireTimerRef.current);
      incomingExpireTimerRef.current = null;
    }

    incomingCallRef.current = null;
    setIncomingCall(null);
    setCallPhaseSafe("idle");
  }, [setCallPhaseSafe, user]);

  const acceptIncomingCall = useCallback(async () => {
    if (!socketRef.current || !user) return;

    const payload = incomingCallRef.current || incomingCall;
    if (!payload) {
      setCallPhaseSafe("idle");
      setStatusText("Call request expired. Ask caller to try again.");
      return;
    }

    try {
      let acceptedType: CallType = payload.callType;

      peerUserIdRef.current = payload.from;
      setRemoteProfile({
        name: payload.callerName || "User",
        avatarInitials: payload.callerAvatar || getInitials(payload.callerName || "User"),
        avatarUrl: payload.callerAvatarUrl || null,
      });

      setCallPhaseSafe("connecting");
      setStatusText("Connecting...");

      const acceptPayload = {
        to: payload.from,
        from: user.id,
        callType: acceptedType,
        conversationId: payload.conversationId,
      };

      if (incomingExpireTimerRef.current) {
        window.clearTimeout(incomingExpireTimerRef.current);
        incomingExpireTimerRef.current = null;
      }

      incomingCallRef.current = null;
      setIncomingCall(null);

      // Acknowledge pickup immediately; if socket is reconnecting, queue it.
      if (socketRef.current.connected) {
        socketRef.current.emit("call:accept", acceptPayload);
      } else {
        pendingAcceptRef.current = acceptPayload;
        socketRef.current.connect();
        setStatusText("Reconnecting signaling...");
      }

      // Media capture is best-effort after pickup acknowledgement.
      try {
        await getMedia(payload.callType);
      } catch (mediaError) {
        if (payload.callType === "video") {
          try {
            await getMedia("audio");
            acceptedType = "audio";
            setCallType("audio");
            currentCallTypeRef.current = "audio";
            setStatusText("Camera unavailable. Continuing as voice call.");

            // Inform caller about downgrade if still connected.
            if (socketRef.current.connected) {
              socketRef.current.emit("call:accept", {
                ...acceptPayload,
                callType: "audio",
              });
            }
          } catch {
            setStatusText("Joined call without local media. You can still receive audio/video.");
          }
        } else {
          setStatusText("Joined call without local mic. You can still receive audio.");
        }
      }
    } catch (error) {
      console.error("Failed to accept incoming call:", error);
      setStatusText("Could not accept call. Please try again.");
    }
  }, [getMedia, incomingCall, setCallPhaseSafe, user]);

  const endCall = useCallback(() => {
    const targetUserId = peerUserIdRef.current;
    if (socketRef.current && user && targetUserId) {
      socketRef.current.emit("call:end", {
        to: targetUserId,
        from: user.id,
      });
    }

    setCallPhaseSafe("idle");
    cleanupCallState();
  }, [cleanupCallState, setCallPhaseSafe, user]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;

    const nextMuted = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;

    const nextCameraOff = !isCameraOff;
    videoTracks.forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setIsCameraOff(nextCameraOff);
  }, [isCameraOff]);

  useEffect(() => {
    if (!user) return;

    const socket = io(SIGNALING_URL, {
      transports: ["polling"],
      upgrade: false,
      reconnection: true,
      reconnectionDelay: 600,
      reconnectionDelayMax: 2500,
      timeout: 10000,
      query: { userId: user.id },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (disconnectTimerRef.current) {
        window.clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setIsSignalingConnected(true);

      if (pendingAcceptRef.current) {
        socket.emit("call:accept", pendingAcceptRef.current);
        pendingAcceptRef.current = null;
        setStatusText("Connecting...");
      }
    });

    socket.on("disconnect", () => {
      if (disconnectTimerRef.current) {
        window.clearTimeout(disconnectTimerRef.current);
      }
      disconnectTimerRef.current = window.setTimeout(() => {
        setIsSignalingConnected(false);
        if (callPhaseRef.current !== "idle") {
          setStatusText(
            callPhaseRef.current === "incoming"
              ? "Incoming call pending. Reconnecting signaling..."
              : "Signaling disconnected"
          );
        }
      }, SIGNALING_DISCONNECT_GRACE_MS);
    });

    socket.on("connect_error", () => {
      setIsSignalingConnected(false);
      if (callPhaseRef.current !== "idle") {
        setStatusText("Unable to reach signaling server");
      }
    });

    socket.on("call:request", (payload: IncomingCallPayload) => {
      if (payload.to !== user.id) return;

      // Handle simultaneous outgoing calls (glare) deterministically.
      if (callPhaseRef.current === "calling" && peerUserIdRef.current === payload.from) {
        // Lexicographically larger user id yields and becomes receiver.
        if (user.id > payload.from) {
          cleanupCallState();
          setCallType(payload.callType);
          currentCallTypeRef.current = payload.callType;
          setRemoteProfile({
            name: payload.callerName || "User",
            avatarInitials: payload.callerAvatar || getInitials(payload.callerName || "User"),
            avatarUrl: payload.callerAvatarUrl || null,
          });
          incomingCallRef.current = payload;
          setIncomingCall(payload);
          setCallPhaseSafe("incoming");
          setStatusText("Incoming call");
          return;
        }

        socket.emit("call:reject", {
          to: payload.from,
          from: user.id,
          reason: "busy",
        });
        return;
      }

      if (callPhaseRef.current !== "idle" || incomingCallRef.current) {
        socket.emit("call:reject", {
          to: payload.from,
          from: user.id,
          reason: "busy",
        });
        return;
      }

      setCallType(payload.callType);
      currentCallTypeRef.current = payload.callType;
      setRemoteProfile({
        name: payload.callerName || "User",
        avatarInitials: payload.callerAvatar || getInitials(payload.callerName || "User"),
        avatarUrl: payload.callerAvatarUrl || null,
      });
      incomingCallRef.current = payload;
      setIncomingCall(payload);
      setCallPhaseSafe("incoming");
      setStatusText("Incoming call");

      if (incomingExpireTimerRef.current) {
        window.clearTimeout(incomingExpireTimerRef.current);
      }
      incomingExpireTimerRef.current = window.setTimeout(() => {
        if (callPhaseRef.current === "incoming" && incomingCallRef.current?.from === payload.from) {
          incomingCallRef.current = null;
          setIncomingCall(null);
          setCallPhaseSafe("idle");
          setStatusText("Call request expired. Ask caller to try again.");
        }
      }, INCOMING_CALL_EXPIRE_MS);
    });

    socket.on("call:accept", async (payload: { from: string; to: string; callType: CallType }) => {
      if (payload.to !== user.id || peerUserIdRef.current !== payload.from) return;
      setCallPhaseSafe("connecting");
      setStatusText("Connecting...");
      await createAndSendOffer();
    });

    socket.on("call:reject", (payload: { from: string; to: string; reason?: string }) => {
      if (payload.to !== user.id || peerUserIdRef.current !== payload.from) return;
      const reasonLabel = payload.reason === "busy"
        ? "User is busy"
        : payload.reason === "unavailable"
          ? "User is offline or not connected"
          : "Call rejected";
      setStatusText(reasonLabel);
      setCallPhaseSafe("idle");
      cleanupCallState();
    });

    socket.on("webrtc:offer", async (payload: { from: string; to: string; sdp: RTCSessionDescriptionInit; callType: CallType }) => {
      if (payload.to !== user.id) return;

      try {
        if (!localStreamRef.current) {
          try {
            await getMedia(payload.callType || "audio");
          } catch (mediaError) {
            if ((payload.callType || "audio") === "video") {
              try {
                await getMedia("audio");
                setCallType("audio");
                currentCallTypeRef.current = "audio";
                setStatusText("Camera unavailable. Continuing as voice call.");
              } catch {
                setStatusText("No local media available. Receiving only.");
              }
            } else {
              setStatusText("Mic unavailable. Receiving only.");
            }
            console.warn("Local media capture failed during offer handling:", mediaError);
          }
        }

        peerUserIdRef.current = payload.from;
        const peer = ensurePeerConnection(payload.from);
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("webrtc:answer", {
          to: payload.from,
          from: user.id,
          sdp: answer,
        });

        setCallPhaseSafe("connecting");
        setStatusText("Connecting...");
      } catch (error) {
        console.error("Failed to handle offer:", error);
      }
    });

    socket.on("webrtc:answer", async (payload: { from: string; to: string; sdp: RTCSessionDescriptionInit }) => {
      if (payload.to !== user.id || !peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch (error) {
        console.error("Failed to handle answer:", error);
      }
    });

    socket.on("webrtc:ice-candidate", async (payload: { from: string; to: string; candidate: RTCIceCandidateInit }) => {
      if (payload.to !== user.id || !peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (error) {
        console.error("Failed to add ICE candidate:", error);
      }
    });

    socket.on("call:end", (payload: { from: string; to: string }) => {
      if (payload.to !== user.id) return;
      setStatusText("Call ended");
      setCallPhaseSafe("idle");
      cleanupCallState();
    });

    return () => {
      if (disconnectTimerRef.current) {
        window.clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      if (statusClearTimerRef.current) {
        window.clearTimeout(statusClearTimerRef.current);
        statusClearTimerRef.current = null;
      }
      if (incomingExpireTimerRef.current) {
        window.clearTimeout(incomingExpireTimerRef.current);
        incomingExpireTimerRef.current = null;
      }
      socket.disconnect();
      socketRef.current = null;
      pendingAcceptRef.current = null;
      setIsSignalingConnected(false);
      cleanupCallState();
    };
  }, [cleanupCallState, createAndSendOffer, ensurePeerConnection, getMedia, setCallPhaseSafe, user]);

  useEffect(() => {
    if (callPhase !== "in-call") return;

    const interval = window.setInterval(() => {
      setDurationSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [callPhase]);

  useEffect(() => {
    const localAudioTracks = localStream?.getAudioTracks() || [];
    const remoteAudioTracks = remoteStream?.getAudioTracks() || [];

    setDiagnostics((prev) => ({
      ...prev,
      localAudioTracks: localAudioTracks.length,
      localAudioEnabled: localAudioTracks.some((track) => track.enabled),
      remoteAudioTracks: remoteAudioTracks.length,
      remoteAudioEnabled: remoteAudioTracks.some((track) => track.enabled),
    }));
  }, [localStream, remoteStream, isMuted]);

  useEffect(() => {
    const peer = peerConnectionRef.current;
    if (!peer || (callPhase !== "connecting" && callPhase !== "in-call")) return;

    const interval = window.setInterval(async () => {
      try {
        const stats = await peer.getStats();
        let packetsSent = 0;
        let packetsReceived = 0;
        let currentRttMs = 0;

        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "audio") {
            packetsSent = Number(report.packetsSent || packetsSent);
          }

          if (report.type === "inbound-rtp" && report.kind === "audio") {
            packetsReceived = Number(report.packetsReceived || packetsReceived);
          }

          if (report.type === "candidate-pair" && (report as RTCStats & { state?: string; currentRoundTripTime?: number }).state === "succeeded") {
            const candidatePair = report as RTCStats & { currentRoundTripTime?: number };
            if (typeof candidatePair.currentRoundTripTime === "number") {
              currentRttMs = Math.round(candidatePair.currentRoundTripTime * 1000);
            }
          }
        });

        setDiagnostics((prev) => ({
          ...prev,
          packetsSent,
          packetsReceived,
          currentRttMs,
          iceState: peer.iceConnectionState,
        }));
      } catch (error) {
        console.error("Failed to collect call stats:", error);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [callPhase, connectionState]);

  useEffect(() => {
    if (!localStream) return;
    const [audioTrack] = localStream.getAudioTracks();
    if (!audioTrack) return;

    const audioContext = new AudioContext();
    const streamSource = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    streamSource.connect(analyser);

    const interval = window.setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, value) => sum + value, 0) / Math.max(1, dataArray.length);
      const normalizedLevel = Math.min(100, Math.round((avg / 255) * 100));

      setDiagnostics((prev) => ({
        ...prev,
        localInputLevel: normalizedLevel,
      }));
    }, 120);

    return () => {
      window.clearInterval(interval);
      analyser.disconnect();
      streamSource.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [localStream]);

  const canToggleCamera = useMemo(() => {
    if (!localStream) return false;
    return localStream.getVideoTracks().length > 0;
  }, [localStream]);

  return {
    callPhase,
    callType,
    connectionState,
    incomingCall,
    localStream,
    remoteStream,
    remoteProfile,
    statusText,
    durationSeconds,
    isMuted,
    isCameraOff,
    canToggleCamera,
    diagnostics,
    isSignalingConnected,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
