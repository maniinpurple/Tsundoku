import { useEffect, useState } from "react";
import { send } from "../../core/messages";
import type { DownloadJob } from "../../core/types";

const POLL_MS = 700;
export const ACTIVE_STATUSES = ["queued", "resolving", "downloading", "converting", "saving"];

export function useDownloads(): DownloadJob[] {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      send("listDownloads", {})
        .then((list) => alive && setJobs(list))
        .catch(() => {});
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return jobs;
}
