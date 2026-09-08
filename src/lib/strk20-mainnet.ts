export const STARKNET_MAINNET_CHAIN_ID = "0x534e5f4d41494e" as const;
export const DEFAULT_STARKNET_MAINNET_ENDPOINTS = [
  { name: "alchemy-demo", url: "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_8/demo" },
  { name: "publicnode", url: "https://starknet-rpc.publicnode.com" },
] as const;

export const STRK20_MAINNET_POOL =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a" as const;
export const STRK20_MAINNET_V2_SOURCE_TAG =
  "CONTRACT_V2_DEPLOYED_MAINNET_2026-07-08" as const;
export const STRK20_MAINNET_V2_CLASS_HASH =
  "0x067dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d" as const;
export const STRK20_MAINNET_EXPECTED_ABI_SHA256 =
  "82048b31b314b22d58ef6c72064ff6ce9ba554ea6b924f9eac7cd032bac9848f" as const;
export const STRK20_MAINNET_EXPECTED_POOL_VERSION = "2.0" as const;
