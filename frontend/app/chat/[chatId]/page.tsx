import { IrisChat } from "@/components/iris-chat";

interface ChatPageProps {
  params: Promise<{
    chatId: string;
  }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { chatId } = await params;
  
  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-hidden">
        <IrisChat chatId={chatId} />
      </div>
    </div>
  );
}
