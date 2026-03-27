import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { RotateCw, X } from "lucide-react";

interface ImageCropDialogProps {
  imageSrc: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
}

export const ImageCropDialog = ({
  imageSrc,
  onCropComplete,
  onCancel,
}: ImageCropDialogProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropAreaChange = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const createCroppedImage = useCallback(async () => {
    try {
      setIsProcessing(true);
      const image = new Image();
      image.src = imageSrc;

      await new Promise((resolve) => {
        image.onload = resolve;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx || !croppedAreaPixels) return;

      // Set canvas size to the cropped area size
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      // Draw the cropped image
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      canvas.toBlob((blob) => {
        if (blob) {
          onCropComplete(blob);
        }
      }, "image/jpeg", 0.9);
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [imageSrc, croppedAreaPixels, onCropComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <h2 className="text-lg font-semibold text-foreground">Crop Image</h2>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-muted rounded-full transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cropper */}
        <div className="flex-1 relative bg-black/20 min-h-[300px]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1 / 1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropAreaChange={onCropAreaChange}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            classes={{
              containerClassName: "!h-full",
            }}
          />
        </div>

        {/* Controls */}
        <div className="border-t border-border p-4 space-y-4 bg-card">
          {/* Zoom */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Zoom
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Rotation */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Rotation
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={360}
                step={15}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 hover:bg-muted rounded-lg transition-all"
              >
                <RotateCw className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-all hover:bg-muted active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={createCroppedImage}
              disabled={isProcessing}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? "Processing..." : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
