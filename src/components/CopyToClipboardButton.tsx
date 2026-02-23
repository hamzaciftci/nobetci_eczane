import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CopyToClipboardButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 rounded-lg">
      {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
      {copied ? "Kopyalandı" : "Kopyala"}
    </Button>
  );
}
