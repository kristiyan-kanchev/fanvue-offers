import { Avatar, type AvatarSize } from "@fanvue/ui";
import { formatPeople } from "@/lib/format";

/** "Coach Maya" → "CM". What shows until, or instead of, a profile picture. */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function CreatorAvatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      src={src ?? undefined}
      alt={name}
      fallback={<span className="typography-body-small-14px-semibold">{initials(name)}</span>}
      className={className}
    />
  );
}

/** Laid out like the creator's own Fanvue profile. Without a cover, a wash of the brand colours stands in. */
export function ProfileHeader({
  creator,
}: {
  creator: {
    displayName: string;
    handle: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    subscribers: number | null;
    followers: number | null;
  };
}) {
  const counts = [
    creator.subscribers !== null && formatPeople(creator.subscribers, "subscriber", "subscribers"),
    creator.followers !== null && formatPeople(creator.followers, "follower", "followers"),
  ].filter(Boolean);

  return (
    <div className="flex flex-col">
      <div
        aria-hidden
        className="h-24 rounded-lg bg-linear-120 from-brand-primary-muted to-brand-secondary-muted bg-cover bg-center sm:h-32"
        style={creator.bannerUrl ? { backgroundImage: `url(${JSON.stringify(creator.bannerUrl)})` } : undefined}
      />
      <div className="flex items-end gap-4 px-4 sm:px-6 -mt-8 sm:-mt-10">
        <CreatorAvatar
          name={creator.displayName}
          src={creator.avatarUrl}
          size={88}
          className="shrink-0 ring-4 ring-background-primary"
        />
        <div className="flex min-w-0 flex-col pb-1">
          <span className="typography-body-default-16px-semibold text-content-primary truncate">
            {creator.displayName}
          </span>
          <span className="typography-body-small-14px-regular text-content-tertiary truncate">
            {creator.handle ? `@${creator.handle}` : null}
            {creator.handle && counts.length ? " · " : null}
            {counts.join(" · ")}
          </span>
        </div>
      </div>
    </div>
  );
}
