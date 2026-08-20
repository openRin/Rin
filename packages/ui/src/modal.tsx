import type { ReactNode } from "react";
import ReactModal from "react-modal";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function configureModalAppElement(selector: string) {
  ReactModal.setAppElement(selector);
}

export function Modal({
  children,
  isOpen,
  onRequestClose,
  contentLabel,
  size = "md",
  position = "center",
  panelClassName,
  shouldCloseOnOverlayClick = true,
  shouldCloseOnEsc = true,
}: {
  children: ReactNode;
  isOpen: boolean;
  onRequestClose?: () => void;
  contentLabel: string;
  size?: "sm" | "md" | "lg";
  position?: "center" | "top";
  panelClassName?: string;
  shouldCloseOnOverlayClick?: boolean;
  shouldCloseOnEsc?: boolean;
}) {
  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel={contentLabel}
      closeTimeoutMS={160}
      shouldCloseOnOverlayClick={shouldCloseOnOverlayClick}
      shouldCloseOnEsc={shouldCloseOnEsc}
      overlayClassName={{
        base: joinClasses("rin-modal-overlay", position === "top" && "rin-modal-overlay--top"),
        afterOpen: "rin-modal-overlay--after-open",
        beforeClose: "rin-modal-overlay--before-close",
      }}
      className={{
        base: joinClasses("rin-modal-content", `rin-modal-content--${size}`),
        afterOpen: "rin-modal-content--after-open",
        beforeClose: "rin-modal-content--before-close",
      }}
    >
      <div className={joinClasses("rin-modal-surface", panelClassName)}>{children}</div>
    </ReactModal>
  );
}
