import CloseIcon from "img/ic_close.svg?react";

export const CloseToastButton = ({ closeToast }: { closeToast: (e: any) => void }) => {
  return (
    <div className="close-toast-button group" onClick={closeToast}>
      <CloseIcon className="size-20 shrink-0 cursor-pointer transition-opacity hover:opacity-70" />
    </div>
  );
};
