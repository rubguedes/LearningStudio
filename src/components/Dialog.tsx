import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { OperationErrorContext } from "../domain/operationError";
import { X } from "lucide-react";

interface Props {
  title: string;
  children: ReactNode;
  onClose(): void;
  busy?: boolean;
}
export function Dialog({ title, children, onClose, busy = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const operationError = useContext(OperationErrorContext);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Fechar"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {operationError && (
        <p className="error" role="alert">
          {operationError}
        </p>
      )}
      {children}
    </dialog>
  );
}
