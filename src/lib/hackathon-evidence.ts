export const ZEEROSTREAM_DEMO_URL = "https://zeerostream.pages.dev" as const;
export const ZEEROSTREAM_DEMO_VIDEO_URL = "https://zeerostream.pages.dev/zeerostream-demo.mp4" as const;
export const ZEEROSTREAM_MANIFEST_URL = "https://zeerostream.pages.dev/strk20.json" as const;

export const ZEEROSTREAM_DEMO_RECEIPTS = [
  {
    step: "1",
    role: "Creator shield",
    detail: "Creator registration and public pool-entry receipt.",
    hash: "0x016301b81ab2fce40fd224140a592a7c23d408ea2f3eb893196c7e4d337f3217",
  },
  {
    step: "2",
    role: "Client shield",
    detail: "Client pool-entry receipt before the private payment.",
    hash: "0x03334787479e79a867e85c7427699a7ad3530934800c11c4ed5b0fc431b59f29",
  },
  {
    step: "3",
    role: "Private payment",
    detail: "Successful pool payment receipt; recipient and amount remain private in the pool.",
    hash: "0x7f11f4e677a5d6d9cf939d652f5c471e081742bc6aec152491dc56e8757aca0",
  },
] as const;
