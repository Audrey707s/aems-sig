import { AsyncLocalStorage } from "node:async_hooks";
import type { Profile } from "@/lib/types/domain";
import type { AemsDatabaseState } from "./seed-data";

/** One isolated database snapshot per request; never shared between users/instances. */
export const aemsRequestState = new AsyncLocalStorage<{ state: AemsDatabaseState; profile?: Profile }>();
