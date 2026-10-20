import React from "react";
import Image from "next/image";
import { Star } from "lucide-react";

export interface ParticipantPreview {
  avatar_url?: string | null;
  badges_json?: string | null;
  seed?: string;
}

interface AvatarStackProps {
  participants: ParticipantPreview[];
  total: number;
}

function parseBadges(json?: string | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export function AvatarStack({ participants, total }: AvatarStackProps) {
  if (!participants || participants.length === 0) return null;

  const displayParticipants = participants.slice(0, 3);
  const remaining = Math.max(0, total - displayParticipants.length);

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2 mr-2">
        {displayParticipants.map((p, i) => {
          const badges = parseBadges(p.badges_json);
          const hasAmbassadorBadge = badges.includes("growth_ambassador");
          const avatarUrl = p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.seed || `User${i}`}`;

          return (
            <div
              key={i}
              className="relative rounded-full w-6 h-6 border-2 border-white ring-1 ring-black/5 bg-gray-100 overflow-hidden"
              style={{ zIndex: 10 - i }}
            >
              <Image
                src={avatarUrl}
                alt="Participant avatar"
                fill
                sizes="24px"
                className="object-cover"
                unoptimized={avatarUrl.includes("dicebear.com")}
              />
              {hasAmbassadorBadge && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-yellow-400 text-white rounded-full p-[1px] shadow-sm ring-1 ring-white">
                  <Star className="w-[8px] h-[8px] fill-current" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {remaining > 0 && (
        <span className="text-[11px] font-medium text-gray-500">
          +{remaining} peserta
        </span>
      )}
      {remaining === 0 && total > 0 && (
        <span className="text-[11px] font-medium text-gray-500">
          peserta
        </span>
      )}
    </div>
  );
}
