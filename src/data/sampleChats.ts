export interface ChatContact {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  isTyping?: boolean;
}

export interface Message {
  id: string;
  text: string;
  timestamp: string;
  isOutgoing: boolean;
  status: "sent" | "delivered" | "read";
}

export const sampleContacts: ChatContact[] = [
  {
    id: "1",
    name: "Alice Johnson",
    avatar: "AJ",
    lastMessage: "See you tomorrow! 😊",
    timestamp: "10:42 AM",
    unreadCount: 2,
    isOnline: true,
  },
  {
    id: "2",
    name: "Dev Team",
    avatar: "DT",
    lastMessage: "Bob: PR is ready for review",
    timestamp: "9:15 AM",
    unreadCount: 5,
    isOnline: false,
  },
  {
    id: "3",
    name: "Mom ❤️",
    avatar: "M",
    lastMessage: "Call me when you're free",
    timestamp: "Yesterday",
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: "4",
    name: "Charlie Park",
    avatar: "CP",
    lastMessage: "That's hilarious 😂",
    timestamp: "Yesterday",
    unreadCount: 0,
    isOnline: true,
    isTyping: true,
  },
  {
    id: "5",
    name: "Work Group",
    avatar: "WG",
    lastMessage: "Meeting moved to 3 PM",
    timestamp: "Monday",
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: "6",
    name: "David Kim",
    avatar: "DK",
    lastMessage: "Thanks for the help!",
    timestamp: "Monday",
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: "7",
    name: "Emma Wilson",
    avatar: "EW",
    lastMessage: "Photo sent 📷",
    timestamp: "Sunday",
    unreadCount: 0,
    isOnline: true,
  },
  {
    id: "8",
    name: "Fitness Buddies",
    avatar: "FB",
    lastMessage: "Sarah: Who's coming to yoga?",
    timestamp: "Saturday",
    unreadCount: 0,
    isOnline: false,
  },
];

export const sampleMessages: Record<string, Message[]> = {
  "1": [
    { id: "m1", text: "Hey! How's the project going?", timestamp: "10:30 AM", isOutgoing: false, status: "read" },
    { id: "m2", text: "Going great! Just finished the main feature", timestamp: "10:32 AM", isOutgoing: true, status: "read" },
    { id: "m3", text: "That's awesome! Can you show me a demo?", timestamp: "10:35 AM", isOutgoing: false, status: "read" },
    { id: "m4", text: "Sure, let me set up a meeting for tomorrow", timestamp: "10:38 AM", isOutgoing: true, status: "delivered" },
    { id: "m5", text: "Perfect, morning works best for me", timestamp: "10:40 AM", isOutgoing: false, status: "read" },
    { id: "m6", text: "See you tomorrow! 😊", timestamp: "10:42 AM", isOutgoing: false, status: "read" },
  ],
  "4": [
    { id: "m1", text: "Did you see that meme I sent?", timestamp: "3:00 PM", isOutgoing: true, status: "read" },
    { id: "m2", text: "YES 🤣🤣🤣", timestamp: "3:02 PM", isOutgoing: false, status: "read" },
    { id: "m3", text: "I can't stop laughing", timestamp: "3:02 PM", isOutgoing: false, status: "read" },
    { id: "m4", text: "That's hilarious 😂", timestamp: "3:03 PM", isOutgoing: false, status: "read" },
  ],
};
