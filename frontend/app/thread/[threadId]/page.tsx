import { IrisChat } from "@/components/iris-chat";

interface ChatPageProps {
  params: Promise<{
    threadId: string;
  }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { threadId } = await params;
  
  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-hidden">
        <IrisChat chatId={threadId} />
      </div>
    </div>
  );
}
