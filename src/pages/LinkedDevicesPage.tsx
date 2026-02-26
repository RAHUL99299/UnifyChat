import { ArrowLeft, Laptop, Smartphone, Plus } from "lucide-react";

interface LinkedDevicesPageProps {
  onBack: () => void;
}

const dummyDevices = [
  { id: "1", name: "Chrome on Windows", icon: Laptop, lastActive: "Active now" },
  { id: "2", name: "WhatsApp Web", icon: Laptop, lastActive: "Last active today at 2:30 PM" },
];

const LinkedDevicesPage = ({ onBack }: LinkedDevicesPageProps) => (
  <div className="flex h-full flex-col bg-card">
    <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground">
      <button onClick={onBack} className="p-1 hover:bg-primary/20 rounded-full transition-colors">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h2 className="text-lg font-semibold">Linked Devices</h2>
    </div>

    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <button className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-4 hover:bg-muted transition-colors">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
            <Plus className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Link a Device</p>
            <p className="text-xs text-muted-foreground">Scan QR code with your phone</p>
          </div>
        </button>
      </div>

      <div className="px-4 pb-2">
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Active sessions</h3>
      </div>

      {dummyDevices.map((device) => (
        <div key={device.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors">
          <device.icon className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{device.name}</p>
            <p className="text-xs text-muted-foreground">{device.lastActive}</p>
          </div>
        </div>
      ))}

      <p className="px-4 py-4 text-xs text-muted-foreground leading-relaxed">
        Use WhatsApp on up to 4 linked devices and 1 phone at the same time. Your personal messages
        are end-to-end encrypted on all your devices.
      </p>
    </div>
  </div>
);

export default LinkedDevicesPage;
