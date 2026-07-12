import Avatar from "@/components/Avatar";
import { buildProfilePath } from "@/lib/profile-path";
import Link from "next/link";

type GroupMemberListItem = {
  id: string;
  slug?: string | null;
  name: string;
  avatarUrl?: string | null;
};

export default function GroupMembersPanel({
  members,
  totalCount,
}: {
  members: GroupMemberListItem[];
  totalCount: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Members</p>
        <span className="text-xs text-slate-500">{totalCount}</span>
      </div>

      {members.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No members yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {members.map((member) => (
            <li key={member.id}>
              <Link
                href={buildProfilePath(member)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-2 hover:bg-slate-50"
              >
                <Avatar
                  name={member.name}
                  avatarUrl={member.avatarUrl}
                  sizeClassName="h-8 w-8"
                  textClassName="text-xs font-semibold"
                />
                <span className="truncate text-sm font-medium text-slate-900">{member.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalCount > members.length && (
        <p className="mt-2 text-xs text-slate-500">Showing the latest {members.length} members.</p>
      )}
    </div>
  );
}
