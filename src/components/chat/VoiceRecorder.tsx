import { useState, useRef, useEffect } from "react";
import { X, Square } from "lucide-react";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationSecs: number) => void;
  onCancel: () => void;
}

const VoiceRecorder = ({ onRecordingComplete, onCancel }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/ogg, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setPermissionDenied(true);
    }
  };

  const stopAndSend = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (timerRef.current) clearInterval(timerRef.current);

    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onRecordingComplete(blob, durationRef.current);
    };
    mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (permissionDenied) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border-t border-border/50">
        <span className="flex-1 text-xs text-destructive">
          Microphone access denied. Please allow microphone in browser settings.
        </span>
        <button onClick={handleCancel} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm px-3 py-3 border-t border-border/50 animate-fade-in">
      {/* Recording indicator */}
      <div className="flex items-center gap-2 flex-1">
        <div className="relative flex items-center justify-center h-9 w-9 rounded-full bg-destructive/15">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-semibold text-destructive">Recording</p>
          <p className="text-sm font-mono text-foreground">{formatDuration(duration)}</p>
        </div>

        {/* Simple waveform animation */}
        <div className="flex items-end gap-0.5 h-6 ml-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-primary/60 animate-wave-bar"
              style={{
                animationDelay: `${i * 60}ms`,
                height: "60%",
              }}
            />
          ))}
        </div>
      </div>

      {/* Cancel */}
      <button
        onClick={handleCancel}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 text-xs font-medium transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Cancel
      </button>

      {/* Stop & Send */}
      <button
        onClick={stopAndSend}
        disabled={duration === 0}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-btn text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
        Send
      </button>
    </div>
  );
};

export default VoiceRecorder;
