import { toast, ToastContent, ToastOptions } from "react-toastify";

const DEFAULT_OPTIONS: ToastOptions = {
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
};

export const helperToast = {
  success: (content: ToastContent, opts?: ToastOptions) => {
    toast.success(content, { ...DEFAULT_OPTIONS, ...opts });
  },
  error: (content: ToastContent, opts?: ToastOptions) => {
    toast.error(content, { ...DEFAULT_OPTIONS, autoClose: 8000, ...opts });
  },
  info: (content: ToastContent, opts?: ToastOptions) => {
    toast(content, { ...DEFAULT_OPTIONS, ...opts });
  },
};
