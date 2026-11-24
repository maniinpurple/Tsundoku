import { browser } from "wxt/browser";
import { listDownloads, startDownloads } from "./downloads";

/**
 * Test builds only (npm run e2e): take one job from the test server and report progress back to it.
 * With WXT_E2E_INTERRUPT the extension reloads itself once mid-download, to test resuming.
 */
export async function runE2e(serverUrl: string, interrupt: boolean) {
  const request = await (await fetch(`${serverUrl}/job`)).json();
  await startDownloads([request]);
  const { e2eReloaded } = await browser.storage.local.get("e2eReloaded");
  setInterval(async () => {
    const jobs = await listDownloads();
    await fetch(`${serverUrl}/progress`, { method: "POST", body: JSON.stringify(jobs) }).catch(() => {});
    const job = jobs.at(-1);
    if (interrupt && !e2eReloaded && job && job.segmentsTotal && job.segmentsDone / job.segmentsTotal > 0.4) {
      await browser.storage.local.set({ e2eReloaded: true });
      await fetch(`${serverUrl}/progress`, { method: "POST", body: JSON.stringify([{ ...job, status: "reloading" }]) });
      browser.runtime.reload();
    }
  }, 2000);
}
