import { ENV } from "../server/_core/env";

console.log("forgeApiUrl:", ENV.forgeApiUrl);
console.log("forgeApiKey exists:", Boolean(ENV.forgeApiKey));
console.log("forgeApiKey length:", ENV.forgeApiKey?.length || 0);
