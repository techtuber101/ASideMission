import { IrisChat } from "@/components/iris-chat";

interface ChatPageProps {
  params: {
    chatId: string;
  };
}

export default function ChatPage({ params }: ChatPageProps) {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-hidden">
        <IrisChat chatId={params.chatId} />
      </div>
    </div>
  );
}
