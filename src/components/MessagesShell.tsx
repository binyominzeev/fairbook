"use client";

import ConversationList from "@/components/ConversationList";
import { usePathname } from "next/navigation";

export default function MessagesShell({
  currentUserId,
  children,
}: {
  currentUserId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hasSelectedConversation = pathname !== "/messages";

  return (
    <main className="mx-auto flex h-[calc(100dvh-4rem)] max-w-6xl">
      <div
        className={`${
          hasSelectedConversation ? "hidden lg:flex" : "flex"
        } w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:w-80 xl:w-96`}
      >
        <ConversationList currentUserId={currentUserId} activePathname={pathname} />
      </div>
      <div className={`${hasSelectedConversation ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col`}>
        {children}
      </div>
    </main>
  );
}
