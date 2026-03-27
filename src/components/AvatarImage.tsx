import React from "react";
import { Avatar, AvatarImage as RadixAvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  src?: string | null;
  initials: string;
  className?: string;
  alt?: string;
}

/**
 * Reusable Avatar component that displays user profile images with fallback to initials
 * Used throughout the app for consistent avatar display
 */
const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  initials,
  className = "h-12 w-12",
  alt = "Avatar",
}) => {
  return (
    <Avatar className={className}>
      {src && <RadixAvatarImage src={src} alt={alt} />}
      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 font-semibold text-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
