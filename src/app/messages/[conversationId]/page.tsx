import ConversationThread from "@/components/ConversationThread";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CONVERSATION_PARTICIPANT_SELECT } from "@/lib/conversations";
import { notFound, redirect } from "next/navigation";

export default async function ConversationPage(props: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { conversationId } = await props.params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: { user: { select: CONVERSATION_PARTICIPANT_SELECT } },
      },
    },
  });

  const isParticipant = conversation?.participants.some((p) => p.userId === session.userId);
  if (!conversation || !isParticipant) {
    notFound();
  }

  return (
    <ConversationThread
      conversationId={conversation.id}
      isGroup={conversation.isGroup}
      name={conversation.name}
      currentUserId={session.userId}
      participants={conversation.participants.map((p) => ({
        ...p.user,
        isCreator: p.isCreator,
        isAdmin: p.isAdmin,
      }))}
    />
  );
}
