import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, Eye, Loader, Image as ImageIcon, Video, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStatuses } from "@/hooks/useStatuses";
import StatusUploadDialog from "@/components/chat/StatusUploadDialog";
import { formatDistanceToNow } from "date-fns";

interface StatusPageProps {
  onBack: () => void;
}

const StatusPage = ({ onBack }: StatusPageProps) => {
  const { user } = useAuth();
  const { myStatuses, otherStatuses, loading, viewedStatusIds, deleteStatus, markAsViewed, getStatusViewers, getStatusViewCount } = useStatuses();
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<any>(null);
  const [statusQueue, setStatusQueue] = useState<any[]>([]);
  const [statusQueueIndex, setStatusQueueIndex] = useState(0);
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [activeDurationMs, setActiveDurationMs] = useState(5000);
  const [isPaused, setIsPaused] = useState(false);
  const [viewersSheetStatusId, setViewersSheetStatusId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const handleDeleteStatus = async (statusId: string) => {
    setDeletingId(statusId);
    const success = await deleteStatus(statusId);
    if (success) {
      setSelectedStatus(null);
    }
    setDeletingId(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const unviewedStatuses = otherStatuses.filter((s) => !viewedStatusIds.has(s.id));
  const viewedStatuses = otherStatuses.filter((s) => viewedStatusIds.has(s.id));
  const latestMyStatus = myStatuses[0] || null;
  const myDisplayName = user?.email?.split("@")[0] || "You";

  const renderStatusSnippet = (status: { content_type: string; content: string }) => {
    if (status.content_type === "text") {
      return <p className="text-xs text-muted-foreground mt-1 truncate">{status.content}</p>;
    }

    return (
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {status.content_type === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
        <span>{status.content_type === "image" ? "Photo" : "Video"}</span>
      </div>
    );
  };

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  };

  const openStatusQueue = useCallback((queue: any[], startIndex = 0) => {
    if (queue.length === 0) return;
    setStatusQueue(queue);
    setStatusQueueIndex(startIndex);
    setSelectedStatus(queue[startIndex]);
    setSegmentProgress(0);
    triggerHaptic();
  }, []);

  const handleNextStatus = useCallback(() => {
    if (statusQueue.length === 0) return;
    const nextIndex = statusQueueIndex + 1;
    if (nextIndex >= statusQueue.length) {
      setSelectedStatus(null);
      setStatusQueue([]);
      setStatusQueueIndex(0);
      setSegmentProgress(0);
      return;
    }
    setStatusQueueIndex(nextIndex);
    setSelectedStatus(statusQueue[nextIndex]);
    setSegmentProgress(0);
    triggerHaptic();
  }, [statusQueue, statusQueueIndex]);

  const handlePrevStatus = useCallback(() => {
    if (statusQueue.length === 0) return;
    const prevIndex = Math.max(0, statusQueueIndex - 1);
    setStatusQueueIndex(prevIndex);
    setSelectedStatus(statusQueue[prevIndex]);
    setSegmentProgress(0);
    triggerHaptic();
  }, [statusQueue, statusQueueIndex]);

  const handlePressStart = () => {
    if (!selectedStatus) return;

    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsPaused(true);
      triggerHaptic();
    }, 180);
  };

  const handlePressEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    setIsPaused(false);
  };

  const handleTapZone = (direction: "left" | "right") => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (direction === "left") {
      handlePrevStatus();
      return;
    }

    handleNextStatus();
  };

  useEffect(() => {
    if (!selectedStatus) return;

    if (isPaused) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const duration =
      selectedStatus.content_type === "video"
        ? activeDurationMs
        : 5000;

    const start = performance.now() - segmentProgress * duration;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setSegmentProgress(progress);

      if (progress >= 1) {
        handleNextStatus();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [selectedStatus, statusQueueIndex, activeDurationMs, handleNextStatus, segmentProgress, isPaused]);

  useEffect(() => {
    if (!selectedStatus || selectedStatus.content_type !== "video" || !videoRef.current) return;

    if (isPaused) {
      videoRef.current.pause();
      return;
    }

    void videoRef.current.play().catch(() => {
      // Autoplay can be blocked by the browser; user controls remain available.
    });
  }, [selectedStatus, isPaused]);

  useEffect(() => {
    if (!selectedStatus) return;
    if (selectedStatus.content_type !== "video") {
      setActiveDurationMs(5000);
      return;
    }

    setActiveDurationMs(8000);
  }, [selectedStatus]);

  const renderMyStatusAvatar = () => {
    if (latestMyStatus?.user_avatar) {
      return (
        <img
          src={latestMyStatus.user_avatar}
          alt="My profile"
          className="h-16 w-16 rounded-full object-cover"
        />
      );
    }

    return (
      <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-base font-bold text-primary">
        {getInitials(myDisplayName)}
      </div>
    );
  };

  const renderStatusCircleAvatar = (
    status: { user_avatar?: string | null } | null,
    fallbackLabel: string,
    sizeClass = "h-12 w-12"
  ) => {
    if (status?.user_avatar) {
      return <img src={status.user_avatar} alt={fallbackLabel} className={`${sizeClass} rounded-full object-cover`} />;
    }

    return (
      <div className={`${sizeClass} rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary`}>
        {getInitials(fallbackLabel)}
      </div>
    );
  };

  const activeStatusViewers = viewersSheetStatusId ? getStatusViewers(viewersSheetStatusId) : [];

  return (
    <div className="relative flex h-full min-w-0 flex-col bg-card">
      <div className="flex items-center gap-3 bg-header px-3 py-3 text-header-foreground sm:px-4">
        <button onClick={onBack} className="min-h-10 min-w-10 rounded-full p-1 hover:bg-primary/20 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Status</h2>
        <div className="flex-1" />
        <button
          onClick={() => setShowUpload(true)}
          className="min-h-10 min-w-10 rounded-full p-1 hover:bg-primary/20 transition-colors"
          title="Create status"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-border px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (latestMyStatus) {
                    const myQueue = myStatuses.map((status) => ({
                      ...status,
                      user_name: "You",
                    }));
                    openStatusQueue(myQueue, 0);
                  } else {
                    setShowUpload(true);
                  }
                }}
                className="flex min-h-16 items-center gap-3 rounded-xl pr-2 text-left transition-colors hover:bg-muted/60"
              >
                <div className={`story-ring relative rounded-full p-[2px] ${latestMyStatus ? "bg-gradient-to-br from-primary via-accent to-primary/40 shadow-[0_0_22px_hsl(var(--primary)/0.35)]" : "bg-border"}`}>
                  {latestMyStatus ? renderStatusCircleAvatar(latestMyStatus, "You", "h-16 w-16") : renderMyStatusAvatar()}
                  {!latestMyStatus && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
                      <Plus className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">My Status</p>
                  <p className="text-xs text-muted-foreground">
                    {latestMyStatus
                      ? `Updated ${formatDistanceToNow(new Date(latestMyStatus.created_at), { addSuffix: true })}`
                      : "Tap to add status update"}
                  </p>
                </div>
              </button>

              {latestMyStatus && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="rounded-full bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground"
                  title="Add new status"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* My status section */}
          {myStatuses.length > 0 && (
            <div className="border-b border-border">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wide px-3 pt-4 pb-2 sm:px-4">
                My Updates
              </h3>
              <div className="px-2 sm:px-3">
                {myStatuses.map((status) => (
                  <div
                    key={status.id}
                    className="group mb-2 flex min-h-16 items-center gap-3 rounded-xl p-2 hover:bg-muted transition-colors relative"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="story-ring rounded-full p-[2px] bg-gradient-to-br from-primary via-accent to-primary/40">
                        {renderStatusCircleAvatar(status, "You", "h-12 w-12")}
                      </div>
                      {status.content_type !== "text" && (
                        <div className="absolute -bottom-1 -right-1 rounded-full bg-card p-1 ring-1 ring-border">
                          {status.content_type === "image" ? <ImageIcon className="h-3 w-3 text-primary" /> : <Video className="h-3 w-3 text-primary" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">Your Status</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(status.created_at), { addSuffix: true })}
                      </p>
                      {renderStatusSnippet(status)}
                      <button
                        onClick={() => setViewersSheetStatusId(status.id)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Viewed by {getStatusViewCount(status.id)}
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const myQueue = myStatuses.map((item) => ({
                          ...item,
                          user_name: "You",
                        }));
                        const idx = myQueue.findIndex((item) => item.id === status.id);
                        openStatusQueue(myQueue, Math.max(0, idx));
                      }}
                      className="rounded-md p-1 text-primary transition-colors hover:bg-primary/10"
                      title="View status"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStatus(status.id)}
                      disabled={deletingId === status.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-destructive"
                      title="Delete status"
                    >
                      {deletingId === status.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact statuses - Unviewed */}
          {unviewedStatuses.length > 0 && (
            <div className="border-b border-border">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wide px-3 pt-4 pb-2 sm:px-4">
                Recent Updates
              </h3>
              <div className="px-2 sm:px-3">
                {unviewedStatuses.map((status) => (
                  <button
                    key={status.id}
                    onClick={() => {
                      const queue = unviewedStatuses.filter((item) => item.user_id === status.user_id);
                      const idx = queue.findIndex((item) => item.id === status.id);
                      openStatusQueue(queue, Math.max(0, idx));
                      markAsViewed(status.id);
                    }}
                    className="w-full mb-2 flex min-h-16 items-center gap-3 rounded-xl p-2 hover:bg-muted transition-colors text-left"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden ring-2 ring-primary bg-muted text-muted-foreground">
                        {status.user_avatar ? (
                          <img src={status.user_avatar} alt={status.user_name} className="h-full w-full object-cover" />
                        ) : (
                          getInitials(status.user_name || "U")
                        )}
                      </div>
                      {status.content_type !== "text" && (
                        <div className="absolute -bottom-1 -right-1 rounded-full bg-card p-1 ring-1 ring-border">
                          {status.content_type === "image" ? <ImageIcon className="h-3 w-3 text-primary" /> : <Video className="h-3 w-3 text-primary" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{status.user_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(status.created_at), { addSuffix: true })}
                      </p>
                      {renderStatusSnippet(status)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contact statuses - Viewed */}
          {viewedStatuses.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-4 pb-2 sm:px-4 flex items-center gap-2">
                <Eye className="h-3 w-3" />
                Viewed
              </h3>
              <div className="px-2 sm:px-3">
                {viewedStatuses.map((status) => (
                  <button
                    key={status.id}
                    onClick={() => {
                      const queue = viewedStatuses.filter((item) => item.user_id === status.user_id);
                      const idx = queue.findIndex((item) => item.id === status.id);
                      openStatusQueue(queue, Math.max(0, idx));
                    }}
                    className="w-full mb-2 flex min-h-16 items-center gap-3 rounded-xl p-2 hover:bg-muted transition-colors text-left opacity-70"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden ring-2 ring-muted-foreground/40 bg-muted/50 text-muted-foreground">
                        {status.user_avatar ? (
                          <img src={status.user_avatar} alt={status.user_name} className="h-full w-full object-cover" />
                        ) : (
                          getInitials(status.user_name || "U")
                        )}
                      </div>
                      {status.content_type !== "text" && (
                        <div className="absolute -bottom-1 -right-1 rounded-full bg-card p-1 ring-1 ring-border">
                          {status.content_type === "image" ? <ImageIcon className="h-3 w-3 text-muted-foreground" /> : <Video className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{status.user_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(status.created_at), { addSuffix: true })}
                      </p>
                      {renderStatusSnippet(status)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {myStatuses.length === 0 && otherStatuses.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="rounded-full bg-muted p-4">
                <Eye className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-center text-sm text-muted-foreground">No statuses yet</p>
            </div>
          )}
        </div>
      )}

      {/* Status Upload Dialog */}
      {showUpload && <StatusUploadDialog onClose={() => setShowUpload(false)} />}

      {/* Status Viewer */}
      {selectedStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 sm:p-4">
          {statusQueue.length > 1 && (
            <div className="absolute left-3 right-3 top-2 z-20 flex gap-1.5 sm:left-4 sm:right-4">
              {statusQueue.map((status, idx) => (
                <div key={status.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      idx < statusQueueIndex
                        ? "w-full bg-white"
                        : idx === statusQueueIndex
                        ? "bg-primary"
                        : "w-0"
                    }`}
                    style={
                      idx === statusQueueIndex
                        ? { width: `${Math.round(segmentProgress * 100)}%` }
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setSelectedStatus(null);
              setStatusQueue([]);
              setStatusQueueIndex(0);
              setSegmentProgress(0);
              setIsPaused(false);
              longPressTriggeredRef.current = false;
            }}
            className="absolute top-4 right-4 text-white hover:bg-white/10 p-2 rounded-full transition-colors z-10"
          >
            <ArrowLeft className="h-6 w-6 rotate-180" />
          </button>

          <div
            className="relative w-full max-w-sm"
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onPointerCancel={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
          >
            {statusQueue.length > 1 && (
              <div className="pointer-events-none absolute inset-0 z-[15] flex">
                <button
                  type="button"
                  onClick={() => handleTapZone("left")}
                  className="pointer-events-auto h-full w-1/2 bg-transparent"
                  aria-label="Previous status"
                />
                <button
                  type="button"
                  onClick={() => handleTapZone("right")}
                  className="pointer-events-auto h-full w-1/2 bg-transparent"
                  aria-label="Next status"
                />
              </div>
            )}

            <div className="mb-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden bg-muted text-muted-foreground">
                {selectedStatus.user_avatar ? (
                  <img src={selectedStatus.user_avatar} alt={selectedStatus.user_name} className="h-full w-full object-cover" />
                ) : (
                  getInitials(selectedStatus.user_name || (selectedStatus.user_id === user?.id ? "You" : "U"))
                )}
              </div>
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{selectedStatus.user_name || (selectedStatus.user_id === user?.id ? "You" : "Unknown")}</p>
                <p className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(selectedStatus.created_at), { addSuffix: true })}
                </p>
              </div>

              {selectedStatus.user_id === user?.id && (
                <button
                  onClick={() => setViewersSheetStatusId(selectedStatus.id)}
                  className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/15"
                >
                  Seen {getStatusViewCount(selectedStatus.id)}
                </button>
              )}
            </div>

            {selectedStatus.content_type === "text" ? (
              <div className="rounded-lg overflow-hidden aspect-square border border-primary/35 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 flex items-center justify-center p-6">
                <p className="max-h-full overflow-y-auto whitespace-pre-wrap text-center text-xl font-semibold leading-relaxed text-white break-words">
                  {selectedStatus.content}
                </p>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden bg-black aspect-square flex items-center justify-center">
                {selectedStatus.content_type === "image" ? (
                  <img
                    src={selectedStatus.content}
                    alt="Status"
                    className="w-full h-full object-cover"
                    onError={(e) =>
                      ((e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23999'%3EImage Not Available%3C/text%3E%3C/svg%3E")
                    }
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={selectedStatus.content}
                    autoPlay
                    className="w-full h-full object-cover"
                    onLoadedMetadata={(e) => {
                      const seconds = e.currentTarget.duration;
                      if (!Number.isFinite(seconds) || seconds <= 0) {
                        setActiveDurationMs(8000);
                        return;
                      }

                      const ms = Math.min(Math.max(seconds * 1000, 3000), 30000);
                      setActiveDurationMs(ms);
                    }}
                    onError={() => console.error("Video failed to load")}
                  />
                )}
              </div>
            )}

            {/* Expiration info */}
            <p className="text-xs text-gray-400 text-center mt-4">
              Expires {formatDistanceToNow(new Date(selectedStatus.expires_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      )}

      {viewersSheetStatusId && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/55" onClick={() => setViewersSheetStatusId(null)}>
          <div
            className="w-full rounded-t-2xl border border-border bg-card p-4 shadow-2xl max-h-[65vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Viewed by</h3>
              <button
                onClick={() => setViewersSheetStatusId(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeStatusViewers.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">No views yet</p>
            ) : (
              <div className="space-y-1">
                {activeStatusViewers.map((viewer) => (
                  <div key={viewer.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/60">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden bg-muted text-muted-foreground">
                      {viewer.viewer_avatar ? (
                        <img src={viewer.viewer_avatar} alt={viewer.viewer_name} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(viewer.viewer_name || "U")
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{viewer.viewer_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">
                        Viewed {formatDistanceToNow(new Date(viewer.viewed_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusPage;
