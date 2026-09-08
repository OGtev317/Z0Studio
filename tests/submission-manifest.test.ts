import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseHackathonSubmission } from "../src/lib/hackathon-submission";
import {
  ZEEROSTREAM_DEMO_RECEIPTS,
  ZEEROSTREAM_DEMO_URL,
  ZEEROSTREAM_DEMO_VIDEO_URL,
} from "../src/lib/hackathon-evidence";

type SubmissionManifest = {
  transactions: unknown;
  contracts: unknown;
  demo_video: unknown;
  demo_url: unknown;
};

async function readJson(path: string): Promise<SubmissionManifest> {
  return JSON.parse(await readFile(path, "utf8")) as SubmissionManifest;
}

test("repository and public STRK20 submission manifests stay identical and honest", async () => {
  const [repositoryManifest, publicManifest] = await Promise.all([
    readJson("strk20.json"),
    readJson("public/strk20.json"),
  ]);

  assert.deepEqual(publicManifest, repositoryManifest);
  parseHackathonSubmission(repositoryManifest);
  assert.deepEqual(repositoryManifest.transactions, ZEEROSTREAM_DEMO_RECEIPTS.map((receipt) => receipt.hash));
  assert.deepEqual(repositoryManifest.contracts, []);
  assert.equal(repositoryManifest.demo_video, ZEEROSTREAM_DEMO_VIDEO_URL);
  assert.equal(repositoryManifest.demo_url, ZEEROSTREAM_DEMO_URL);
});
