import { AlertCircle, RefreshCcw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

const ErrorState = ({
  message = "Veriler yüklenirken bir hata oluştu.",
  onRetry,
}: ErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <h3 className="font-display font-bold text-foreground mb-1">Bir sorun oluştu</h3>
      <p className="text-xs text-muted-foreground max-w-xs mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <RefreshCcw className="h-3 w-3" />
          Tekrar Dene
        </button>
      )}
    </div>
  );
};

export default ErrorState;
