/**
 * Avatar with online/offline indicator (green/gray dot)
 * Based on avatar-standard-4 (online) and avatar-standard-5 (offline)
 */
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export default function UserAvatarWithPresence({
  name,
  email,
  avatarUrl,
  isOnline,
  className,
}) {
  const initial = name?.charAt(0) || email?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className={cn('relative w-fit flex items-center gap-3', className)}>
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage alt={name || email} src={avatarUrl} />
          <AvatarFallback className="bg-primary text-primary-foreground font-bold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-background',
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          )}
          title={isOnline ? 'Online' : 'Offline'}
        />
      </div>
      {(name != null || email != null) && (
        <div>
          <p className="font-medium text-foreground">{name || 'No name'}</p>
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
        </div>
      )}
    </div>
  );
}
