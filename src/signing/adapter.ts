import type { UnsignedTx, SigningResult } from "../shared/types.js";

export interface SigningAdapter {
  readonly name: string;
  /** Present tx to the device for clear-signing; broadcast on approval. */
  signAndBroadcast(tx: UnsignedTx): Promise<SigningResult>;
}
