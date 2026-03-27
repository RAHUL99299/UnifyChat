import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Maximize2,
} from "lucide-react";
import { CallPhase, CallType } from "@/hooks/useWebRTCCall";

interface CallOverlayProps {
  callPhase: CallPhase;
  callType: CallType;
  statusText: string;
  durationSeconds: number;
  remoteName: string;
  remoteAvatarInitials: string;
  remoteAvatarUrl: string | null;
  connectionState: string;
  incomingCall: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  canToggleCamera: boolean;
  diagnostics: {
    localAudioTracks: number;
    localAudioEnabled: boolean;
    remoteAudioTracks: number;
    remoteAudioEnabled: boolean;
    localInputLevel: number;
    packetsSent: number;
    packetsReceived: number;
    currentRttMs: number;
    iceState: string;
  };
  isSignalingConnected: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const CallOverlay = ({
  callPhase,
  callType,
  statusText,
  durationSeconds,
  remoteName,
  remoteAvatarInitials,
  remoteAvatarUrl,
  connectionState,
  incomingCall,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  canToggleCamera,
  diagnostics,
  isSignalingConnected,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
}: CallOverlayProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const bumpStreamVersion = () => {
    setStreamVersion((value) => value + 1);
  };

  useEffect(() => {
    if (!localStream) return;

    const onTrackChange = () => {
      bumpStreamVersion();
    };

    localStream.addEventListener("addtrack", onTrackChange);
    localStream.addEventListener("removetrack", onTrackChange);

    localStream.getTracks().forEach((track) => {
      track.addEventListener("mute", onTrackChange);
      track.addEventListener("unmute", onTrackChange);
      track.addEventListener("ended", onTrackChange);
    });

    return () => {
      localStream.removeEventListener("addtrack", onTrackChange);
      localStream.removeEventListener("removetrack", onTrackChange);
      localStream.getTracks().forEach((track) => {
        track.removeEventListener("mute", onTrackChange);
        track.removeEventListener("unmute", onTrackChange);
        track.removeEventListener("ended", onTrackChange);
      });
    };
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;

    const onTrackChange = () => {
      bumpStreamVersion();
    };

    remoteStream.addEventListener("addtrack", onTrackChange);
    remoteStream.addEventListener("removetrack", onTrackChange);

    remoteStream.getTracks().forEach((track) => {
      track.addEventListener("mute", onTrackChange);
      track.addEventListener("unmute", onTrackChange);
      track.addEventListener("ended", onTrackChange);
    });

    return () => {
      remoteStream.removeEventListener("addtrack", onTrackChange);
      remoteStream.removeEventListener("removetrack", onTrackChange);
      remoteStream.getTracks().forEach((track) => {
        track.removeEventListener("mute", onTrackChange);
        track.removeEventListener("unmute", onTrackChange);
        track.removeEventListener("ended", onTrackChange);
      });
    };
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.onloadedmetadata = () => {
        void localVideoRef.current?.play().catch(() => {});
      };
      void localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, streamVersion]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.onloadedmetadata = () => {
        void remoteVideoRef.current?.play().catch(() => {});
      };
      void remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.onloadedmetadata = () => {
        void remoteAudioRef.current?.play().catch(() => {});
      };
      void remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, streamVersion]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!overlayRef.current) return;
    if (!document.fullscreenElement) {
      await overlayRef.current.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  };

  if (callPhase === "idle") return null;

  const isIncoming = callPhase === "incoming";
  const hasLocalVideoTrack = !!localStream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled);
  const hasRemoteVideoTrack = !!remoteStream?.getVideoTracks().some((track) => track.readyState === "live");
  const showVideoLayout = (callType === "video" || hasLocalVideoTrack || hasRemoteVideoTrack)
    && (callPhase === "in-call" || callPhase === "connecting");

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm">
      <div className="relative flex h-full w-full items-center justify-center p-3 sm:p-4">
        {showVideoLayout && (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute bottom-24 right-3 h-32 w-20 rounded-xl border border-white/20 bg-black/40 object-cover shadow-xl sm:bottom-24 sm:right-4 sm:h-36 sm:w-24"
            />
          </>
        )}

        {!showVideoLayout && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-3xl font-bold text-white overflow-hidden">
              {remoteAvatarUrl ? (
                <img src={remoteAvatarUrl} alt={remoteName} className="h-full w-full object-cover" />
              ) : (
                remoteAvatarInitials
              )}
            </div>
          </div>
        )}

        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="absolute left-1/2 top-4 w-[min(94vw,26rem)] -translate-x-1/2 rounded-2xl bg-black/40 px-3 py-2 text-center text-white sm:top-6 sm:px-4">
          <p className="truncate text-sm font-semibold sm:text-base">{remoteName}</p>
          <p className="text-xs text-white/80">{statusText || (isIncoming ? "Incoming call" : connectionState)}</p>
          {!isSignalingConnected && <p className="text-[11px] text-amber-300 mt-1">Signaling disconnected</p>}
          {callPhase === "in-call" && <p className="text-xs text-white/80 mt-1">{formatDuration(durationSeconds)}</p>}
        </div>

        {isIncoming && (
          <div className="absolute left-1/2 top-1/2 w-[min(92vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/60 p-4 text-center text-white shadow-2xl sm:p-5">
            <p className="text-lg font-semibold">Incoming {callType === "video" ? "video" : "voice"} call</p>
            <p className="mt-1 text-sm text-white/80">{remoteName} is calling you</p>
            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                onClick={onReject}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600"
                title="Reject"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
              <button
                onClick={onAccept}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600"
                title="Accept"
              >
                <Phone className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {(callPhase === "connecting" || callPhase === "in-call") && (
          <div className="absolute left-1/2 top-[80px] w-[min(94vw,620px)] -translate-x-1/2 rounded-2xl bg-black/45 p-3 text-white shadow-lg sm:top-[88px]">
            <p className="text-[11px] font-semibold tracking-wide text-white/90">Live Diagnostics</p>
            <div className="mt-1 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
              <p>Local audio tracks: <span className="font-semibold">{diagnostics.localAudioTracks}</span></p>
              <p>Remote audio tracks: <span className="font-semibold">{diagnostics.remoteAudioTracks}</span></p>
              <p>Local enabled: <span className="font-semibold">{diagnostics.localAudioEnabled ? "yes" : "no"}</span></p>
              <p>Remote enabled: <span className="font-semibold">{diagnostics.remoteAudioEnabled ? "yes" : "no"}</span></p>
              <p>ICE state: <span className="font-semibold">{diagnostics.iceState}</span></p>
              <p>RTT: <span className="font-semibold">{diagnostics.currentRttMs} ms</span></p>
              <p>Packets sent: <span className="font-semibold">{diagnostics.packetsSent}</span></p>
              <p>Packets recv: <span className="font-semibold">{diagnostics.packetsReceived}</span></p>
            </div>
            <div className="mt-2">
              <p className="text-[11px]">Mic input level: <span className="font-semibold">{diagnostics.localInputLevel}%</span></p>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-green-400 transition-all"
                  style={{ width: `${diagnostics.localInputLevel}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 min-h-10 min-w-10 rounded-full bg-black/45 p-2 text-white hover:bg-black/65 sm:right-6 sm:top-6"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {!isIncoming && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 sm:bottom-6">
            <>
              <button
                onClick={onToggleMute}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              {callType === "video" && (
                <button
                  onClick={onToggleCamera}
                  disabled={!canToggleCamera}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 disabled:opacity-40"
                  title={isCameraOff ? "Turn camera on" : "Turn camera off"}
                >
                  {isCameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </button>
              )}

              <button
                onClick={onEnd}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600"
                title="End call"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallOverlay;
