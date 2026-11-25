import { deleteConversation } from '@/lib/chat-store';
import { readOwner } from '@/lib/owner';

/** Deletes one of this browser's chats on the server (messages and traces). Other owners' chats are untouched. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/chats/[id]'>) {
  const id = (await ctx.params).id;
  const owner = readOwner(req);
  if (owner && id.length <= 100) await deleteConversation(owner, id);
  return new Response(null, { status: 204 });
}
