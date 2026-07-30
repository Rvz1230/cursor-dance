type DesktopUpdateStatus =
  | "unsupported"
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

export type DesktopUpdateState = Readonly<{
  status: DesktopUpdateStatus;
  version?: string;
  percent?: number;
  message?: string;
  checkedAt?: number;
}>;
