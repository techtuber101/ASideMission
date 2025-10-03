import { IrisChat } from "@/components/iris-chat";

export default function Page() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-hidden">
        <IrisChat />
      </div>
    </div>
  );
}